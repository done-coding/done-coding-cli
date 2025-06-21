import type { Options } from "@/types";
import injectInfo from "@/injectInfo.json";
import type { CliHandlerArgv, CliInfo } from "@done-coding/cli-utils";

const { version, description: describe } = injectInfo;

const getOptions = (): CliInfo["options"] => {
  return {
    xx: {
      alias: "x",
      describe: "模版测试",
      type: "string",
      demandOption: true,
    },
  };
};

export const handler = async (argv: CliHandlerArgv<Options>) => {
  console.log(argv);
};

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  options: getOptions(),
  handler: handler as CliInfo["handler"],
};
