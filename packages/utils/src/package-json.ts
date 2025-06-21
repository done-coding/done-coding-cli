import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import _merge from "lodash.merge";

const PACKAGE_JSON_PATH = "package.json";

/** package.json文件内容 */
export interface PackageJson {
  name: string;
  version?: string;
  bin?: Record<string, string> | string;
  scripts?: Record<string, string>;
  files?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** 获取package.json文件内容 */
export const getPackageJson = <R extends PackageJson>({
  rootDir,
}: {
  rootDir: string;
}): R => {
  const packageJsonPath = path.resolve(rootDir, PACKAGE_JSON_PATH);

  if (!existsSync(packageJsonPath)) {
    throw new Error(`${rootDir}未找到package.json文件`);
  }
  const pkgStr = readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(pkgStr) as R;
  return pkg;
};

/** 获取依赖包版本 */
export const getRelyPkgVersion = <R extends PackageJson>({
  rootDir,
  pkgJson,
  pkgName,
  isDevPkg,
}: {
  rootDir: string;
  pkgJson?: R;
  pkgName: string;
  /** 是开发依赖包 */
  isDevPkg: boolean;
}) => {
  const pkgInfo = pkgJson || getPackageJson({ rootDir });
  const pkgDeps = isDevPkg ? pkgInfo.devDependencies : pkgInfo.dependencies;

  let version: string | undefined = pkgDeps?.[pkgName];
  if (!version) {
    // 可能存在非开发依赖包安装在devDependencies中
    const pkgDepsMaybe = isDevPkg
      ? pkgInfo.dependencies
      : pkgInfo.devDependencies;
    version = pkgDepsMaybe?.[pkgName];
    if (version) {
      console.log(
        chalk.yellow(
          `${isDevPkg ? "开发" : "生产"}依赖包${pkgName}可能错误的安装在${
            isDevPkg ? "dependencies" : "devDependencies"
          }`,
        ),
      );
    }
    return;
  }

  if (!version) {
    console.log(chalk.cyan(`依赖包${pkgName}未安装`));
  }

  return version;
};

/** 添加package.json配置 */
export const addPackageConfig = ({
  patchConfig,
  rootDir,
}: {
  patchConfig?: Record<string, any>;
  rootDir: string;
}) => {
  if (!patchConfig) {
    return;
  }
  const packageJson = getPackageJson({ rootDir });

  const newContent = _merge(packageJson, patchConfig);

  const packageJsonPath = path.resolve(rootDir, PACKAGE_JSON_PATH);

  writeFileSync(packageJsonPath, JSON.stringify(newContent, null, 2), "utf-8");
};
