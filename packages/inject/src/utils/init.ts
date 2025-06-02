import type { CliHandlerArgv } from "@done-coding/cli-utils";
import type { InitOptions } from "./types";
import {
  getConfigFileCommonOptions,
  initHandlerCommon,
  log,
} from "@done-coding/cli-utils";
import configDefault from "@/json/default";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "./path";

/** 获取初始化选项 */
export const getInitOptions = () =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

/** 初始化命令处理器 */
export const initHandler = async (argv: CliHandlerArgv<InitOptions>) => {
  return initHandlerCommon(configDefault, argv, {
    onFileGenerated: () => {
      log.info(`文件生成成功`);
    },
  });
};
