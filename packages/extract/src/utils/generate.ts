import {
  readConfigFile,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";
import type { GenerateOptions } from "./types";

/** 获取生成命令选项 */
export const getGenerateOptions = (): CliInfo["options"] => {
  return {};
};

/** 提取文件命令处理器 */
export const generateHandler = async (
  argv: CliHandlerArgv<GenerateOptions>,
) => {
  console.log(argv);
  const content = await readConfigFile(argv);
  console.log(content);
};
