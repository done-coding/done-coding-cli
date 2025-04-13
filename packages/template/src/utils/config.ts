import injectInfo from "@/injectInfo.json";
import path from "node:path";
import fs from "node:fs";

/** 获取配置文件路径 */
export const getConfigPath = (rootDir?: string) => {
  const { namespaceDir, moduleName } = injectInfo.cliConfig;

  const resolveParams = [namespaceDir, `${moduleName}.json`];
  if (rootDir) {
    resolveParams.unshift(rootDir);
  }
  const configPath = path.resolve(...resolveParams);

  if (!fs.existsSync(configPath)) {
    return undefined;
  } else {
    return configPath;
  }
};
