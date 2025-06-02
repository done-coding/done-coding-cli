import type { GenerateOptions, InitOptions } from "@/utils";
import { initHandler, generateHandler, SubcommandEnum } from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";

/** 命令处理函数 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<InitOptions | GenerateOptions>,
) => {
  if (command === SubcommandEnum.INIT) {
    return initHandler(argv as InitOptions);
  } else if (command === SubcommandEnum.GENERATE) {
    return generateHandler(argv as GenerateOptions);
  } else {
    log.error(`无效的命令: ${command}`);
    return process.exit(1);
  }
};
