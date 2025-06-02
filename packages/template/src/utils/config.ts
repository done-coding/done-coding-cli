import path from "node:path";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "./path";
import { existsSync } from "node:fs";
import type { ReadConfigFileOptions } from "@done-coding/cli-utils";

/** 获取配置文件路径 */
export const getConfigPath = ({
  rootDir,
  configPath = MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
}: ReadConfigFileOptions) => {
  const configPathFinal = path.resolve(rootDir, configPath);

  if (existsSync(configPathFinal)) {
    return configPathFinal;
  } else {
    return;
  }
};
