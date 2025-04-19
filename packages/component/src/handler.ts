import type { Options } from "@/utils";
import {
  addComponent,
  listComponent,
  removeComponent,
  SubcommandEnum,
} from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import chalk from "chalk";

/** 子命令处理函数 */
export const subHandler = async (
  command: SubcommandEnum,
  argv: ArgumentsCamelCase<Options> | Options,
) => {
  if (command === SubcommandEnum.ADD) {
    return addComponent(argv);
  } else if (command === SubcommandEnum.REMOVE) {
    return removeComponent(argv);
  } else if (command === SubcommandEnum.LIST) {
    return listComponent();
  } else {
    console.log(chalk.red(`无效的命令: ${command}`));
    return process.exit(1);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
  // console.log("component 子命令处理函数", argv);
};
