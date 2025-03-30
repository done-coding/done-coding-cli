import path, { dirname } from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** 包信息 */
export interface PackageInfo {
  name: string;
  version: string;
}

/** 读取报信息 */
const readPkg = () => {
  const pkgStr = fs.readFileSync(
    path.join(__dirname, "../../package.json"),
    "utf-8",
  );
  return JSON.parse(pkgStr) as PackageInfo;
};

/** 获取版本号 */
export const getVersion = () => {
  return readPkg().version;
};

/** 获取包名 */
export const getPkgName = () => {
  return readPkg().name;
};
