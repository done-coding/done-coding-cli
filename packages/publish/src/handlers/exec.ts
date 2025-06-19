import {
  type ExecOptions,
  type GitInfo,
  type NpmInfo,
  type ConfigInfo,
  PublishModeEnum,
  PublishVersionTypeEnum,
  PublishTagEnum,
} from "@/types";
import type {
  CliHandlerArgv,
  CliInfo,
  PackageJson,
  SubCliInfo,
} from "@done-coding/cli-utils";
import type { ReleaseType } from "semver";
import { inc, prerelease } from "semver";
import { execSync } from "node:child_process";
import pinyin from "pinyin";
import {
  getConfigFileCommonOptions,
  getPackageJson,
  log,
  readConfigFile,
  xPrompts,
} from "@done-coding/cli-utils";
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

export type ChildCmd = "npm" | "web";

/**
 * 获取git信息
 */
const getGitInfo = ({ gitOriginName }: ConfigInfo): GitInfo => {
  try {
    const lastHash = execSync(`git rev-parse HEAD`).toString().trim();
    const lastCommitter = execSync('git log -1 --pretty=format:"%an"')
      .toString()
      .trim();
    const lastCommitEmail = execSync('git log -1 --pretty=format:"%ae"')
      .toString()
      .trim();
    const lastCommitMsg = execSync('git log -1 --pretty=format:"%s"')
      .toString()
      .trim();
    const userName = execSync("git config user.name").toString().trim();
    const userEmail = execSync("git config user.email").toString().trim();
    const branchName = execSync("git rev-parse --abbrev-ref HEAD")
      .toString()
      .trim();
    let remoteUrl = "";
    try {
      remoteUrl = execSync(`git config --get remote.${gitOriginName}.url`)
        .toString()
        .trim();
    } catch (e) {
      // 如果git remote ${gitOriginName} 不存在，则可能会出现错误
      throw new Error(`git remote ${gitOriginName} 不存在`);
    }

    return {
      lastHash,
      lastCommitter,
      lastCommitterPinYin: pinyin(lastCommitter, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      }).join(""),
      lastCommitEmail,
      lastCommitMsg,
      userName,
      userNamePinYin: pinyin(userName, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      }).join(""),
      userEmail,
      branchName,
      remoteUrl,
    };
  } catch (err) {
    console.error("Error fetching git information:", err);
    throw err;
  }
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

export const execHandler = async (argv: CliHandlerArgv<ExecOptions>) => {
  const { mode, type: typeInit, push, rootDir } = argv;

  const configInfo = await readConfigFile<ConfigInfo>(argv, () => {
    return {
      gitOriginName: "origin",
    };
  });

  const gitInfo = getGitInfo(configInfo);

  const packageJson = getPackageJson({ rootDir });

  let type = typeInit;
  let npmInfo: NpmInfo;
  if (type) {
    npmInfo = await getNpmInfo({
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

    type = (
      await xPrompts({
        type: "select",
        name: "type",
        message: `请选择发布类型，当前版本：${packageJson.version}`,
        choices,
      })
    ).type;
    npmInfo = versionMap[type!];
  }

  const { version } = npmInfo;

  execSync(`npm version ${version}`, {
    stdio: "inherit",
  });

  try {
    if (mode === PublishModeEnum.NPM) {
      const { tag } = npmInfo;
      execSync(`npm publish --tag ${tag}`, {
        stdio: "inherit",
      });
    } else if (mode === PublishModeEnum.WEB) {
      const { webBuild } = configInfo;
      if (webBuild) {
        execSync(`${webBuild}`, {
          stdio: "inherit",
        });
      } else {
        log.warn("webBuild为空，不执行web构建");
      }
    } else {
      throw new Error("未知命令");
    }
  } catch (error: any) {
    log.error(`发布失败, error: ${error.message}`);

    try {
      log.info(`回滚本地版本到发布前的版本：${gitInfo.lastHash}`);
      const { lastHash } = gitInfo;
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
    execSync(`git push ${configInfo.gitOriginName} v${npmInfo.version}`, {
      stdio: "inherit",
    });
    execSync(`git push ${configInfo.gitOriginName} ${gitInfo.branchName}`, {
      stdio: "inherit",
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
