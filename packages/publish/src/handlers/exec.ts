import type { ConfigInfo, ConfigInfoWeb, ExecOptions, NpmInfo } from "@/types";
import {
  PublishModeEnum,
  PublishTagEnum,
  PublishVersionTypeEnum,
} from "@/types";
import type {
  CliHandlerArgv,
  CliInfo,
  PackageJson,
  SubCliInfo,
} from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  getGitLastCommitInfo,
  getPackageJson,
  log,
  pushGitPublishInfoToRemote,
  readConfigFile,
  xPrompts,
} from "@done-coding/cli-utils";
import { execSync } from "node:child_process";
import type { ReleaseType } from "semver";
import { inc, prerelease } from "semver";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";

export const getExecOptions = (): CliInfo["options"] => {
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
      choices: [
        PublishVersionTypeEnum.MAJOR,
        PublishVersionTypeEnum.MINOR,
        PublishVersionTypeEnum.PATCH,
        PublishVersionTypeEnum.PREMAJOR,
        PublishVersionTypeEnum.PREMINOR,
        PublishVersionTypeEnum.PREPATCH,
        PublishVersionTypeEnum.PRERELEASE,
      ],
    },
    push: {
      alias: "p",
      describe: "是否推送至远程仓库",
      type: "boolean",
      default: true,
    },
  };
};

/**
 * 获取npmInfo
 */
const getNpmInfo = ({
  packageJson,
  type,
}: {
  type: PublishVersionTypeEnum;
  packageJson: PackageJson;
}): NpmInfo => {
  let name = packageJson.name;
  let version = "";
  let tag: NpmInfo["tag"];

  const { version: currentVersion } = packageJson;

  if (!currentVersion) {
    throw new Error("当前版本号为空");
  }

  if (
    [
      PublishVersionTypeEnum.MAJOR as ReleaseType,
      PublishVersionTypeEnum.MINOR as ReleaseType,
      PublishVersionTypeEnum.PATCH as ReleaseType,
    ].includes(type)
  ) {
    version = inc(currentVersion, type as ReleaseType)!;
    tag = PublishTagEnum.LATEST;
  } else if (
    [
      PublishVersionTypeEnum.PREMAJOR as ReleaseType,
      PublishVersionTypeEnum.PREMINOR as ReleaseType,
      PublishVersionTypeEnum.PREPATCH as ReleaseType,
    ].includes(type)
  ) {
    const prereleaseRes = prerelease(currentVersion);

    if (prereleaseRes) {
      log.warn("当前版本已经是预发布版本，将会在当前版本基础上进行发布");
      if (prereleaseRes.length === 1 && typeof prereleaseRes[0] === "number") {
        version = inc(
          currentVersion,
          PublishVersionTypeEnum.PRERELEASE as ReleaseType,
        )!;
      } else {
        // version = inc(currentVersion.split("-")[0], type)!;
        version = currentVersion.split("-")[0] + "-0";
      }
    } else {
      version = inc(currentVersion, type as ReleaseType)!;
    }
    tag = PublishTagEnum.NEXT;
  } else {
    tag = PublishTagEnum.ALPHA;
    version = inc(
      currentVersion,
      PublishVersionTypeEnum.PRERELEASE as ReleaseType,
      tag,
    )!;
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
}: {
  type?: PublishVersionTypeEnum;
  packageJson: PackageJson;
}) => {
  if (type) {
    return await getNpmInfo({
      packageJson,
      type,
    });
  } else {
    const keys = Object.values(PublishVersionTypeEnum).filter(
      (item) => item.toUpperCase() !== item,
    ) as PublishVersionTypeEnum[];

    const versionMap = keys.reduce(
      (acc, type) => {
        acc[type] = getNpmInfo({
          packageJson,
          type,
        });
        return acc;
      },
      {} as unknown as {
        [key in PublishVersionTypeEnum]: NpmInfo;
      },
    );
    /** 版本选项 */
    const choices = [
      {
        title: `主版本(${versionMap[PublishVersionTypeEnum.MAJOR].version})`,
        value: PublishVersionTypeEnum.MAJOR,
      },
      {
        title: `次版本(${versionMap[PublishVersionTypeEnum.MINOR].version})`,
        value: PublishVersionTypeEnum.MINOR,
      },
      {
        title: `修订版本(${versionMap[PublishVersionTypeEnum.PATCH].version})`,
        value: PublishVersionTypeEnum.PATCH,
      },
      {
        title: `预发布主版本(${
          versionMap[PublishVersionTypeEnum.PREMAJOR].version
        })`,
        value: PublishVersionTypeEnum.PREMAJOR,
      },
      {
        title: `预发布次版本(${
          versionMap[PublishVersionTypeEnum.PREMINOR].version
        })`,
        value: PublishVersionTypeEnum.PREMINOR,
      },
      {
        title: `预发布修订版本(${
          versionMap[PublishVersionTypeEnum.PREPATCH].version
        })`,
        value: PublishVersionTypeEnum.PREPATCH,
      },
      {
        title: `alpha版本(${
          versionMap[PublishVersionTypeEnum.PRERELEASE].version
        })`,
        value: PublishVersionTypeEnum.PRERELEASE,
      },
    ];

    const { type } = await xPrompts({
      type: "select",
      name: "type",
      message: `请选择发布类型，当前版本：${packageJson.version}`,
      choices,
    });
    return versionMap[type as PublishVersionTypeEnum];
  }
};

export const execHandler = async (argv: CliHandlerArgv<ExecOptions>) => {
  const { mode, type, push, rootDir } = argv;

  const configInfo = await readConfigFile<ConfigInfo>(argv, () => {
    return {};
  });

  const modeConfigInfo = configInfo[mode];

  const lastCommitInfo = await getGitLastCommitInfo(modeConfigInfo);

  const packageJson = getPackageJson({ rootDir });

  const npmInfo = await dispatchNpmInfo({
    type,
    packageJson,
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
    log.error(`发布失败, error: ${error.message}`);

    try {
      log.info(`回滚本地版本到发布前的版本：${lastCommitInfo.lastHash}`);
      const { lastHash } = lastCommitInfo;
      execSync(`git reset --hard ${lastHash}`, {
        stdio: "inherit",
      });
      log.info(`删除本次发布时生成的tag：v${npmInfo.version}`);
      execSync(`git tag -d v${npmInfo.version}`, {
        stdio: "inherit",
      });
    } catch (error: any) {
      log.error(`回滚失败, error: ${error.message}`);
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

  log.success(`发布成功，版本号：${version}`);
};

export const execCommandCliInfo: SubCliInfo = {
  command: `$0`,
  describe: "执行发布命令",
  options: getExecOptions(),
  handler: execHandler as SubCliInfo["handler"],
};
