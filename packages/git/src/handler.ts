import { SubcommandEnum, clone as gitClone } from "@/utils";
import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import chalk from "chalk";

/** 子命令处理函数 */
export const subHandler = async (
  command: SubcommandEnum,
  argv: ArgumentsCamelCase<Options> | Options,
) => {
  console.log("com", argv);
  if (command === SubcommandEnum.CLONE) {
    return gitClone(argv);
  } else {
    console.log(chalk.red(`无效的命令: ${command}`));
    return process.exit(1);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
  // console.log("component 子命令处理函数", argv);
};
