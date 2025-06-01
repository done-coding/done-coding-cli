import { SubcommandEnum, gitClone } from "@/utils";
import type { Options } from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";

/** 子命令处理函数 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<Options>,
) => {
  if (command === SubcommandEnum.CLONE) {
    return gitClone(argv);
  } else {
    log.error(`无效的命令: ${command}`);
    return process.exit(1);
  }
};
