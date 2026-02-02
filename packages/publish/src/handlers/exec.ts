import type { ConfigInfo, ConfigInfoWeb, ExecOptions, NpmInfo } from "@/types";
import {
  PublishModeEnum,
  PublishTagEnum,
  PublishVersionTypeEnum,
} from "@/types";
import type {
  CliHandlerArgv,
  PackageJson,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  getGitLastCommitInfo,
  getPackageJson,
  outputConsole,
  pushGitPublishInfoToRemote,
  readConfigFile,
  xPrompts,
} from "@done-coding/cli-utils";
import type { ReleaseType } from "semver";
import { inc } from "semver";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";
import { aliasHandler, getAliasInfoList } from "./alias";
import { execSync } from "node:child_process";
export const getExecOptions = (): YargsOptionsRecord<ExecOptions> => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
    mode: {
      alias: "m",
      describe: "发布模式",
      choices: [PublishModeEnum.NPM, PublishModeEnum.WEB],
      default: PublishModeEnum.NPM,
    },
    type: {
      alias: "t",
      describe: "发布类型",
      choices: Object.values(PublishVersionTypeEnum),
    },
    push: {
      alias: "p",
      describe: "是否推送至远程仓库",
      type: "boolean",
      default: true,
    },
    distTag: {
      alias: "d",
      describe: "发布标签",
      choices: Object.values(PublishTagEnum),
    },
  };
};

/**
 * 获取npmInfo
 */
const getNpmInfo = async ({
  packageJson,
  type,
  distTag,
}: {
  type: PublishVersionTypeEnum;
  packageJson: PackageJson;
  distTag?: PublishTagEnum;
}): Promise<NpmInfo> => {
  let name = packageJson.name;
  let version = "";
  let tag: NpmInfo["tag"];

  const { version: currentVersion } = packageJson;

  if (!currentVersion) {
    throw new Error("当前版本号为空");
  }

  switch (type) {
    case PublishVersionTypeEnum.PATCH:
    case PublishVersionTypeEnum.MINOR:
    case PublishVersionTypeEnum.MAJOR: {
      version = inc(currentVersion, type as ReleaseType)!;
      tag = distTag || PublishTagEnum.LATEST;
      break;
    }
    case PublishVersionTypeEnum.PREPATCH:
    case PublishVersionTypeEnum.PREMINOR:
    case PublishVersionTypeEnum.PREMAJOR: {
      version = inc(currentVersion, type as ReleaseType, PublishTagEnum.ALPHA)!;
      tag = distTag || PublishTagEnum.ALPHA;
      break;
    }
    case PublishVersionTypeEnum.PRERELEASE: {
      const identifier = (
        await xPrompts({
          type: "text",
          name: "identifier",
          message: "请输入修饰符",
          initial: PublishTagEnum.ALPHA,
        })
      ).identifier;

      version = inc(currentVersion, type as ReleaseType, identifier)!;
      tag = distTag || identifier;
      break;
    }
    default: {
      version = (
        await xPrompts({
          type: "text",
          name: "customVersion",
          message: "请输入自定义版本号",
        })
      ).customVersion;
      tag = distTag || PublishTagEnum.LATEST;
    }
  }

  if (!version) {
    throw new Error("version is empty");
  }

  return {
    name,
    version,
    tag,
  };
};

/** 分发npmInfo */
const dispatchNpmInfo = async ({
  type,
  packageJson,
  distTag,
}: {
  type?: PublishVersionTypeEnum;
  packageJson: PackageJson;
  distTag?: PublishTagEnum;
}): Promise<NpmInfo> => {
  if (type) {
    return await getNpmInfo({
      packageJson,
      type,
      distTag,
    });
  } else {
    const versionMap = {} as unknown as {
      [key in PublishVersionTypeEnum]: NpmInfo;
    };

    /** 可以计算版本号的类型 */
    const canExecVersionTypeList = [
      PublishVersionTypeEnum.PATCH,
      PublishVersionTypeEnum.MINOR,
      PublishVersionTypeEnum.MAJOR,
      PublishVersionTypeEnum.PREPATCH,
      PublishVersionTypeEnum.PREMINOR,
      PublishVersionTypeEnum.PREMAJOR,
    ];

    for (let type of canExecVersionTypeList) {
      versionMap[type] = await getNpmInfo({
        packageJson,
        type,
        distTag,
      });
    }

    /** 版本选项 */
    const choices = [
      ...canExecVersionTypeList.map((type) => {
        return {
          title: `${type} (${versionMap[type].version})`,
          value: type,
        };
      }),
      ...[
        PublishVersionTypeEnum.PRERELEASE,
        PublishVersionTypeEnum.CUSTOM_VERSION,
      ].map((type) => {
        return {
          title: type,
          value: type,
        };
      }),
    ];

    const selectType = (
      await xPrompts({
        type: "select",
        name: "selectType",
        message: `请选择发布类型，当前版本：${packageJson.version}`,
        choices,
      })
    ).selectType as PublishVersionTypeEnum;

    if (canExecVersionTypeList.includes(selectType)) {
      return versionMap[selectType];
    } else {
      return getNpmInfo({
        packageJson,
        type: selectType,
        distTag,
      });
    }
  }
};

export const execHandler = async (argv: CliHandlerArgv<ExecOptions>) => {
  const { mode, type, push, rootDir, distTag } = argv;

  const configInfo = await readConfigFile<ConfigInfo>(argv, () => {
    return {};
  });

  const modeConfigInfo = configInfo[mode];

  const lastCommitInfo = await getGitLastCommitInfo(modeConfigInfo);

  const packageJson = getPackageJson({ rootDir });

  const npmInfo = await dispatchNpmInfo({
    type,
    packageJson,
    distTag,
  });

  const { version } = npmInfo;

  execSync(`npm version ${version}`, {
    cwd: rootDir,
    stdio: "inherit",
  });

  const { tag } = npmInfo;
  try {
    switch (mode) {
      case PublishModeEnum.WEB: {
        const { build } = modeConfigInfo as ConfigInfoWeb;
        if (build) {
          execSync(`${build}`, {
            stdio: "inherit",
            cwd: rootDir,
          });
        } else {
          throw new Error("未配置build命令");
        }
        break;
      }
      case PublishModeEnum.NPM: {
        execSync(`npm publish --tag ${tag}`, {
          cwd: rootDir,
          stdio: "inherit",
        });
        break;
      }
      default: {
        throw new Error(`未知发布模式：${mode}`);
      }
    }
  } catch (error: any) {
    outputConsole.error(`发布失败, error: ${error.message}`);

    try {
      outputConsole.info(
        `回滚本地版本到发布前的版本：${lastCommitInfo.lastHash}`,
      );
      const { lastHash } = lastCommitInfo;
      execSync(`git reset --hard ${lastHash}`, {
        stdio: "inherit",
      });
      outputConsole.info(`删除本次发布时生成的tag：v${npmInfo.version}`);
      execSync(`git tag -d v${npmInfo.version}`, {
        stdio: "inherit",
      });
    } catch (error: any) {
      outputConsole.error(`回滚失败, error: ${error.message}`);
    }
    return process.exit(1);
  }

  // 是否推送到远程仓库
  if (push) {
    pushGitPublishInfoToRemote({
      branchName: lastCommitInfo.branchName,
      version: npmInfo.version,
      remoteInfo: lastCommitInfo.remoteInfo,
    });
  }

  outputConsole.success(`发布成功，版本号：${version}`);

  if (mode === PublishModeEnum.NPM && getAliasInfoList(configInfo)) {
    aliasHandler(argv);
  }
};

export const execCommandCliInfo: SubCliInfo = {
  command: `$0`,
  describe: "执行发布命令",
  options: getExecOptions(),
  handler: execHandler as SubCliInfo["handler"],
};
