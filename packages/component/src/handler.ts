import type { Options } from "@/utils";
import { addComponent, removeComponent, SubcommandEnum } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import chalk from "chalk";

/** 子命令处理函数 */
export const subHandler = async (
  command: SubcommandEnum,
  argv: ArgumentsCamelCase<Options>,
) => {
  console.log("com", argv);
  if (command === SubcommandEnum.ADD) {
    return addComponent(argv);
  } else if (command === SubcommandEnum.REMOVE) {
    console.log(chalk.green("移除组件"));
    return removeComponent();
  } else {
    console.log(chalk.red("无效的命令"));
    return process.exit(1);
  }
};

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log("component 子命令处理函数", argv);
};
