import {
  handler as initHandler,
  commandCliInfo as initCommandCliInfo,
} from "./init";
import {
  handler as cloneHandler,
  commandCliInfo as cloneCommandCliInfo,
} from "./clone";
import {
  handler as hooksHandler,
  commandCliInfo as hooksCommandCliInfo,
} from "./hooks";
import {
  handler as checkHandler,
  commandCliInfo as checkCommandCliInfo,
} from "./check";
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
  cloneHandler,
  cloneCommandCliInfo,
  hooksHandler,
  hooksCommandCliInfo,
  checkHandler,
  checkCommandCliInfo,
};

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.INIT: {
      return initHandler(argv);
    }
    case SubcommandEnum.CLONE: {
      return cloneHandler(argv);
    }
    case SubcommandEnum.HOOKS: {
      return hooksHandler(argv);
    }
    case SubcommandEnum.CHECK: {
      return checkHandler(argv);
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
    cloneCommandCliInfo,
    hooksCommandCliInfo,
    checkCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
