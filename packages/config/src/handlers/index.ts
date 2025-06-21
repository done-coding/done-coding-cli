import {
  handler as checkHandler,
  commandCliInfo as checkCommandCliInfo,
} from "./check";
import {
  handler as addHandler,
  commandCliInfo as addCommandCliInfo,
} from "./add";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export { checkHandler, checkCommandCliInfo, addHandler, addCommandCliInfo };

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.CHECK: {
      return checkHandler(argv);
    }
    case SubcommandEnum.ADD: {
      return addHandler(argv);
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
  subcommands: [checkCommandCliInfo, addCommandCliInfo].map(createSubcommand),
  demandCommandCount: 1,
};
