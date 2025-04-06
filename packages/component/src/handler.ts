import type { Options, SubcommandEnum } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";

/** 子命令处理函数 */
export const subHandler = async (
  command: SubcommandEnum,
  argv: ArgumentsCamelCase<Options>,
) => {
  console.log("com", argv);
};

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log("component 子命令处理函数", argv);
};
