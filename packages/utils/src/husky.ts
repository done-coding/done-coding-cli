import { fileAddX } from "@/file-operate";
import path from "node:path";
import fs from "node:fs";
import { getPackageJson, getRelyPkgVersion } from "@/package-json";
import semver from "semver";
import { getGitProjectDir } from "@/git";
import { outputConsole } from "@/env-config";

export enum HooksNameEnum {
  /** 预提交 */
  PRE_COMMIT = "pre-commit",
  /** 预合并提交 */
  PRE_MERGE_COMMIT = "pre-merge-commit",
  /** 准备提交信息 */
  PREPARE_COMMIT_MSG = "prepare-commit-msg",
  /** 提交消息 */
  COMMIT_MSG = "commit-msg",
  /** 变基前 */
  PRE_REBASE = "pre-rebase",
  /** 提交后 */
  POST_COMMIT = "post-commit",
  /** 合并后 */
  POST_MERGE = "post-merge",
  /** 推送前 */
  PRE_PUSH = "pre-push",
}

/** husky包名 */
const HUSKY_PKG_NAME = "husky";

/** husky hooks 目录 */
const HUSKY_DIR = ".husky";

/** 获取husky引导代码 */
const getHuskyBootCode = ({ rootDir }: { rootDir: string }) => {
  const projectRootDir = getGitProjectDir(rootDir);
  const versionInit = getRelyPkgVersion({
    rootDir: projectRootDir,
    pkgJson: getPackageJson({ rootDir: projectRootDir }),
    pkgName: HUSKY_PKG_NAME,
    isDevPkg: true,
  });

  if (!versionInit) {
    throw new Error("husky版本获取失败, 可能husky未安装");
  }

  const version = versionInit.replace(/^(\^|~)/, "");

  const needRootCodeVersionRange = "<9.0.0";
  // 小于9.0.0版本
  if (semver.satisfies(version, needRootCodeVersionRange)) {
    outputConsole.info(`${version}符合${needRootCodeVersionRange}`);
    return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"`;
  } else {
    outputConsole.info(`${version}不符合${needRootCodeVersionRange}`);
  }
  return "";
};

/** 获取husky根目录 */
const getHuskyRootDir = ({ rootDir }: { rootDir: string }) => {
  const projectRootDir = getGitProjectDir(rootDir);
  return path.resolve(projectRootDir, HUSKY_DIR);
};

/** 添加 husky hooks */
export const addHuskyHooks = <H extends string>({
  hookNames,
  rootDir,
  getCode,
}: {
  hookNames: H[];
  /** 运行目录 */
  rootDir: string;
  /** 获取husky hooks 添加的代码 */
  getCode: (hook: string) => string;
}) => {
  const huskyRootDir = getHuskyRootDir({ rootDir });
  if (!fs.existsSync(huskyRootDir)) {
    fs.mkdirSync(huskyRootDir, { recursive: true });
  }
  hookNames.forEach((name) => {
    const hooksFilePath = path.resolve(huskyRootDir, name);

    const isExist = fs.existsSync(hooksFilePath);

    let code = getCode(name);

    if (isExist) {
      const content = fs.readFileSync(hooksFilePath, "utf-8");
      if (!content.includes(code)) {
        fs.appendFileSync(
          hooksFilePath,
          `
${code}
`,
        );
        outputConsole.success(`${hooksFilePath} 添加 ${name}相关调用成功`);
      } else {
        outputConsole.skip(
          `${hooksFilePath} ${name}相关调用 ${code} 已存在 跳过`,
        );
      }
    } else {
      const bootCode = getHuskyBootCode({
        rootDir,
      });
      fs.writeFileSync(
        hooksFilePath,
        `${bootCode}

${code}
`,
        "utf-8",
      );
      outputConsole.success(`${hooksFilePath} 添加 ${name}相关调用成功`);
    }
    fileAddX(hooksFilePath);
  });
};
