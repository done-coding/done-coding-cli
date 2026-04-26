import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type TestOptions } from "@/types";

/** 获取初始化选项 */
export const getOptions = (): YargsOptionsRecord<TestOptions> => {
  return {
    xx: {
      type: "string",
      alias: "x",
      describe: "测试选项",
      default: "测试参数xx",
    },
  };
};

/** 初始化命令处理器 */
export const handler = async (argv: CliHandlerArgv<TestOptions>) => {
  outputConsole.log("test命令", argv);
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.TEST,
  describe: "测试命令",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
