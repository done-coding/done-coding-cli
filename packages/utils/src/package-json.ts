import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PACKAGE_JSON_PATH = "./package.json";

export interface PackageJson {
  name: string;
  version?: string;
}

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
