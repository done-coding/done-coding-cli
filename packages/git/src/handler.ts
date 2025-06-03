import { SubcommandEnum, initHandler, cloneHandler } from "@/utils";
import type { InitOptions, CloneOptions } from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";

/** 子命令处理函数 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<InitOptions | CloneOptions>,
) => {
  switch (command) {
    case SubcommandEnum.INIT: {
      return initHandler(argv as InitOptions);
    }
    case SubcommandEnum.CLONE: {
      return cloneHandler(argv as CloneOptions);
    }
    default: {
      log.error(`无效的命令: ${command}`);
      return process.exit(1);
    }
  }
};
