import type { Options } from "@/utils";
import {
  addComponent,
  listComponent,
  removeComponent,
  SubcommandEnum,
} from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";

/** 命令处理函数 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<Options>,
) => {
  if (command === SubcommandEnum.ADD) {
    return addComponent(argv);
  } else if (command === SubcommandEnum.REMOVE) {
    return removeComponent(argv);
  } else if (command === SubcommandEnum.LIST) {
    return listComponent();
  } else {
    log.error(`无效的命令: ${command}`);
    return process.exit(1);
  }
};
