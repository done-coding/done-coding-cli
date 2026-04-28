import { handler as lsHandler, commandCliInfo as lsCommandCliInfo } from "./ls";
import {
  handler as switchHandler,
  commandCliInfo as switchCommandCliInfo,
} from "./switch";
import {
  handler as providerAddHandler,
  commandCliInfo as providerAddCommandCliInfo,
} from "./provider-add";
import {
  handler as providerUseHandler,
  commandCliInfo as providerUseCommandCliInfo,
} from "./provider-use";
import {
  handler as providerRemoveHandler,
  commandCliInfo as providerRemoveCommandCliInfo,
} from "./provider-remove";
import {
  handler as modelAddHandler,
  commandCliInfo as modelAddCommandCliInfo,
} from "./model-add";
import {
  handler as modelRemoveHandler,
  commandCliInfo as modelRemoveCommandCliInfo,
} from "./model-remove";
import {
  handler as modelUseHandler,
  commandCliInfo as modelUseCommandCliInfo,
  useCommandCliInfo,
} from "./model-use";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export {
  lsHandler,
  switchHandler,
  providerAddHandler,
  providerUseHandler,
  providerRemoveHandler,
  modelAddHandler,
  modelRemoveHandler,
  modelUseHandler,
};

/** 导出供外部编程使用 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.LS:
      return lsHandler(argv);
    case SubcommandEnum.SWITCH:
      return switchHandler(argv);
    case SubcommandEnum.USE:
    case SubcommandEnum.MODEL_USE:
      return modelUseHandler(argv);
    case SubcommandEnum.MODEL_ADD:
      return modelAddHandler(argv);
    case SubcommandEnum.MODEL_REMOVE:
      return modelRemoveHandler(argv);
    case SubcommandEnum.PROVIDER_ADD:
      return providerAddHandler(argv);
    case SubcommandEnum.PROVIDER_USE:
      return providerUseHandler(argv);
    case SubcommandEnum.PROVIDER_REMOVE:
      return providerRemoveHandler(argv);
    default:
      throw new Error(`不支持的命令 ${command}`);
  }
};

const { version, description: describe } = injectInfo;

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [
    switchCommandCliInfo,
    lsCommandCliInfo,
    providerAddCommandCliInfo,
    providerUseCommandCliInfo,
    providerRemoveCommandCliInfo,
    modelAddCommandCliInfo,
    modelRemoveCommandCliInfo,
    modelUseCommandCliInfo,
    /** use 快捷命令（同 model use） */
    useCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
