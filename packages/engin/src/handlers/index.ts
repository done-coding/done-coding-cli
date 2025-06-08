import { SubcommandEnum } from "@/types";
import type { CliInfo } from "@done-coding/cli-utils";
import { createSubcommand, type CliHandlerArgv } from "@done-coding/cli-utils";
import { initCommandCliInfo, initHandler } from "./init";
import { addCommandCliInfo, addHandler } from "./add";
import injectInfo from "@/injectInfo.json";

export { initHandler, initCommandCliInfo, addHandler, addCommandCliInfo };

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.INIT: {
      return initHandler(argv);
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
  subcommands: [initCommandCliInfo, addCommandCliInfo].map(createSubcommand),
  demandCommandCount: 1,
};
