import {
  handler as initHandler,
  commandCliInfo as initCommandCliInfo,
} from "./init";
import {
  handler as compileHandler,
  commandCliInfo as compileCommandCliInfo,
  batchCompileHandler,
} from "./compile";
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
  compileHandler,
  compileCommandCliInfo,
  batchCompileHandler,
};

export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.INIT: {
      return initHandler(argv);
    }
    case SubcommandEnum.COMPILE: {
      return compileHandler(argv);
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
  subcommands: [initCommandCliInfo, compileCommandCliInfo].map(
    createSubcommand,
  ),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
