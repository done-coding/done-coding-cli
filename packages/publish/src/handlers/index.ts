import { initHandler, initCommandCliInfo } from "./init";
import { execHandler, execCommandCliInfo } from "./exec";
import { aliasHandler, aliasCommandCliInfo } from "./alias";
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
  execHandler,
  execCommandCliInfo,
  aliasHandler,
  aliasCommandCliInfo,
};

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.INIT: {
      return initHandler(argv);
    }
    case SubcommandEnum.EXEC: {
      return execHandler(argv);
    }
    case SubcommandEnum.ALIAS: {
      return aliasHandler(argv);
    }
    default: {
      throw new Error(`不支持的命令 ${command}`);
    }
  }
};

const { version, description: describe } = injectInfo;

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [
    initCommandCliInfo,
    execCommandCliInfo,
    aliasCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
