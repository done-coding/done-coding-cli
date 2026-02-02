/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-24 23:02:01
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:44:11
 */
import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { SubcommandEnum, type InitOptions } from "@/types";
import {
  getConfigFileCommonOptions,
  initHandlerCommon,
  outputConsole,
} from "@done-coding/cli-utils";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";
import configDefault from "@/config";

/** 获取初始化选项 */
export const getOptions = () =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

/** 初始化命令处理器 */
export const handler = async (argv: CliHandlerArgv<InitOptions>) => {
  return initHandlerCommon(configDefault, argv, {
    onFileGenerated: () => {
      outputConsole.info(`文件生成成功`);
    },
  });
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INIT,
  describe: "初始化配置文件",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
