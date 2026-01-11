import {
  handler as addHandler,
  commandCliInfo as addCommandCliInfo,
} from "./add";
import {
  handler as removeHandler,
  commandCliInfo as removeCommandCliInfo,
} from "./remove";
import {
  handler as listHandler,
  commandCliInfo as listCommandCliInfo,
} from "./list";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export {
  addHandler,
  addCommandCliInfo,
  removeHandler,
  removeCommandCliInfo,
  listHandler,
  listCommandCliInfo,
};

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.ADD: {
      return addHandler(argv);
    }
    case SubcommandEnum.REMOVE: {
      return removeHandler(argv);
    }
    case SubcommandEnum.LIST: {
      return listHandler(argv);
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
    addCommandCliInfo,
    removeCommandCliInfo,
    listCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
