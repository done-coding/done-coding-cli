import type { CompileOptions, InitOptions } from "@/utils";
import { initHandler, compileHandler, SubcommandEnum } from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";

/** 命令处理函数 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<InitOptions | CompileOptions>,
) => {
  if (command === SubcommandEnum.INIT) {
    return initHandler(argv as InitOptions);
  } else if (command === SubcommandEnum.COMPILE) {
    return compileHandler(argv as CompileOptions);
  } else {
    log.error(`无效的命令: ${command}`);
    return process.exit(1);
  }
};
