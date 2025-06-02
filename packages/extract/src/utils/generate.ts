import {
  readConfigFile,
  getConfigFileCommonOptions,
  type CliHandlerArgv,
  type CliInfo,
  log,
} from "@done-coding/cli-utils";
import type { ExtractConfig, GenerateOptions } from "./types";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "./path";

/** 获取生成命令选项 */
export const getGenerateOptions = (): CliInfo["options"] => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
  };
};

/** 提取文件命令处理器 */
export const generateHandler = async (
  argv: CliHandlerArgv<GenerateOptions>,
) => {
  console.log(argv);
  const content = await readConfigFile<ExtractConfig>(argv);
  if (!content) {
    log.warn(`配置文件为空`);
  }
  console.log(content);
};
