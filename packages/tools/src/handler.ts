import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log(argv);
};
