import {
  handler as createHandler,
  commandCliInfo as createCommandCliInfo,
} from "./create";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export { createHandler, createCommandCliInfo };

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.CREATE:
    default: {
      return createHandler(argv);
    }
  }
};

const { version, description: describe } = injectInfo;

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [createCommandCliInfo].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
