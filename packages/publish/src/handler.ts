import type { ArgumentsCamelCase } from "yargs";
import {
  type Options,
  type GitInfo,
  type NpmInfo,
  type ConfigInfo,
  PublishModeEnum,
  PublishVersionTypeEnum,
  PublishTagEnum,
} from "@/utils";
import type { ReleaseType } from "semver";
import { inc, prerelease } from "semver";
import { join } from "node:path";
import { execSync } from "node:child_process";
import pinyin from "pinyin";
import { readFileSync, existsSync } from "node:fs";
import chalk from "chalk";
import prompts from "prompts";
import { onPromptFormStateForSigint } from "@done-coding/cli-utils";

const configPath = "/.dc/publish.json";

const pkgPath = "/package.json";

export type ChildCmd = "npm" | "web";

/**
 * 获取git信息
 */
const getGitInfo = ({ gitOriginName = "origin" }: ConfigInfo): GitInfo => {
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
const getNpmInfo = (
  type: PublishVersionTypeEnum,
  pkg = JSON.parse(readFileSync(join(process.cwd(), pkgPath), "utf-8")),
): NpmInfo => {
  let name = pkg.name;
  let version = "";
  let tag: NpmInfo["tag"];

  // console.log(84, type);

  const { version: currentVersion } = pkg;

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

    // console.log(94, prereleaseRes);

    if (prereleaseRes) {
      console.log(
        chalk.yellow("当前版本已经是预发布版本，将会在当前版本基础上进行发布"),
      );
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

/**
 * 获取配置信息
 */
const getConfig = (): ConfigInfo => {
  let cfg;
  const path = join(process.cwd(), configPath);
  if (existsSync(path)) {
    const cfgStr = readFileSync(path, "utf-8");
    cfg = JSON.parse(cfgStr);
  } else {
    console.log(
      chalk.yellow(`未找到配置文件，将使用默认配置
      { gitOriginName: "origin" }
    `),
    );
  }
  return {
    gitOriginName: "origin",
    ...(cfg || {}),
  };
};

export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
  console.log(argv);

  const { mode, type: typeInit, push } = argv;

  const configInfo = getConfig();

  const gitInfo = getGitInfo(configInfo);

  console.log("gitInfo:", gitInfo);

  let type = typeInit;
  let npmInfo: NpmInfo;
  if (type) {
    console.log("type:", type);
    npmInfo = await getNpmInfo(type!);
  } else {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), pkgPath), "utf-8"));
    const versionMap: {
      [key in PublishVersionTypeEnum]: NpmInfo;
    } = {
      [PublishVersionTypeEnum.MAJOR]: getNpmInfo(
        PublishVersionTypeEnum.MAJOR,
        pkg,
      ),
      [PublishVersionTypeEnum.MINOR]: getNpmInfo(
        PublishVersionTypeEnum.MINOR,
        pkg,
      ),
      [PublishVersionTypeEnum.PATCH]: getNpmInfo(
        PublishVersionTypeEnum.PATCH,
        pkg,
      ),
      [PublishVersionTypeEnum.PREMAJOR]: getNpmInfo(
        PublishVersionTypeEnum.PREMAJOR,
        pkg,
      ),
      [PublishVersionTypeEnum.PREMINOR]: getNpmInfo(
        PublishVersionTypeEnum.PREMINOR,
        pkg,
      ),
      [PublishVersionTypeEnum.PREPATCH]: getNpmInfo(
        PublishVersionTypeEnum.PREPATCH,
        pkg,
      ),
      [PublishVersionTypeEnum.PRERELEASE]: getNpmInfo(
        PublishVersionTypeEnum.PRERELEASE,
        pkg,
      ),
    };
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
      await prompts({
        type: "select",
        name: "type",
        message: `请选择发布类型，当前版本：${pkg.version}`,
        choices,
        onState: onPromptFormStateForSigint,
      })
    ).type;
    npmInfo = versionMap[type!];
  }

  const { version } = npmInfo;

  console.log("npmInfo:", npmInfo);

  execSync(`npm version ${version} 1>&2`);

  // console.log("138, configInfo:", configInfo);

  try {
    if (mode === PublishModeEnum.NPM) {
      const { tag } = npmInfo;
      execSync(`npm publish --tag ${tag} 1>&2`);
    } else if (mode === PublishModeEnum.WEB) {
      const { webBuild } = configInfo;
      if (webBuild) {
        execSync(`${webBuild} 1>&2`);
      } else {
        console.log(chalk.yellow("webBuild为空，不执行web构建"));
      }
    } else {
      throw new Error("未知命令");
    }
  } catch (error: any) {
    console.log(chalk.red(`发布失败, error: ${error.message}`));

    try {
      console.log(
        chalk.blue(`回滚本地版本到发布前的版本：${gitInfo.lastHash}`),
      );
      const { lastHash } = gitInfo;
      execSync(`git reset --hard ${lastHash} 1>&2`);
      console.log(chalk.blue(`删除本次发布时生成的tag：v${npmInfo.version}`));
      execSync(`git tag -d v${npmInfo.version} 1>&2`);
    } catch (error: any) {
      console.log(chalk.red(`回滚失败, error: ${error.message}`));
    }
    return process.exit(1);
  }

  // 是否推送到远程仓库
  if (push) {
    execSync(`git push ${configInfo.gitOriginName} v${npmInfo.version} 1>&2`);
    execSync(`git push ${configInfo.gitOriginName} ${gitInfo.branchName} 1>&2`);
  }

  console.log(chalk.green("发布成功"));
};
