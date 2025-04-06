import type { Options, SubcommandEnum } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";

/** 子命令处理函数 */
export const subHandler = async (
  command: SubcommandEnum,
  argv: ArgumentsCamelCase<Options>,
) => {
  console.log(argv);
};

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log(12, argv);
};
