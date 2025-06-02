import type { CliHandlerArgv } from "@done-coding/cli-utils";
import injectInfo from "@/injectInfo.json";
import type { InitOptions } from "./types";
import {
  getConfigFileInitOptions,
  initHandlerCommon,
} from "@done-coding/cli-utils";
import configDefault from "@/json/default.json";

const {
  cliConfig: { namespaceDir, moduleName },
} = injectInfo;

/** 获取初始化选项 */
export const getInitOptions = () =>
  getConfigFileInitOptions({
    configPathDefault: `./${namespaceDir}/${moduleName}.json`,
  });

/** 初始化命令处理器 */
export const initHandler = async (argv: CliHandlerArgv<InitOptions>) => {
  return initHandlerCommon(configDefault, argv, {
    onFileGenerated: () => {
      console.log(`文件生成成功`);
    },
  });
};
