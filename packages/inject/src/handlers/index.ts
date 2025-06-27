import {
  handler as initHandler,
  commandCliInfo as initCommandCliInfo,
} from "./init";
import {
  handler as generateHandler,
  commandCliInfo as generateCommandCliInfo,
  generateFile,
} from "./generate";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export {
  initHandler,
  initCommandCliInfo,
  generateHandler,
  generateCommandCliInfo,
  generateFile,
};

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.INIT: {
      return initHandler(argv);
    }
    case SubcommandEnum.GENERATE: {
      return generateHandler(argv);
    }
    default: {
      return generateHandler(argv);
    }
  }
};

const { version, description: describe } = injectInfo;

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [initCommandCliInfo, generateCommandCliInfo].map(
    createSubcommand,
  ),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
