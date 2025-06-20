import { fileAddX } from "./file-operate";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { getPackageJson, getRelyPkgVersion } from "./package-json";
import semver from "semver";

/** husky包名 */
const HUSKY_PKG_NAME = "husky";

/** husky hooks 目录 */
const HUSKY_DIR = ".husky";

/** 获取husky引导代码 */
export const getHuskyBootCode = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
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
    console.log(chalk.cyan(`${version}符合${needRootCodeVersionRange}`));
    return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"`;
  } else {
    console.log(chalk.cyan(`${version}不符合${needRootCodeVersionRange}`));
  }
  return "";
};

/** 获取husky根目录 */
export const getHuskyRootDir = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  return path.resolve(projectRootDir, HUSKY_DIR);
};

/** 添加 husky hooks */
export const addHuskyHooks = <H extends string>({
  hookNames,
  projectRootDir,
  getCode,
}: {
  hookNames: H[];
  /** 项目根目录 */
  projectRootDir: string;
  /** 获取husky hooks 添加的代码 */
  getCode: (hook: string) => string;
}) => {
  const huskyRootDir = getHuskyRootDir({ projectRootDir });
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
        console.log(chalk.green(`${hooksFilePath} 添加 ${name}相关调用成功`));
      } else {
        console.log(
          chalk.gray(`${hooksFilePath} ${name}相关调用 ${code} 已存在 跳过`),
        );
      }
    } else {
      const bootCode = getHuskyBootCode({
        projectRootDir,
      });
      fs.writeFileSync(
        hooksFilePath,
        `${bootCode}

${code}
`,
        "utf-8",
      );
      console.log(chalk.green(`${hooksFilePath} 添加 ${name}相关调用成功`));
    }
    fileAddX(hooksFilePath);
  });
};
