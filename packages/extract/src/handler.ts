import type { Options } from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";

export const handler = async (argv: CliHandlerArgv<Options>) => {
  console.log(argv);
};
