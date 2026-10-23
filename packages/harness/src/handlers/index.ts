import {
  handler as listsHandler,
  commandCliInfo as listsCommandCliInfo,
} from "./lists";
import {
  handler as checkHandler,
  commandCliInfo as checkCommandCliInfo,
} from "./check";
import {
  handler as issueHandler,
  commandCliInfo as issueCommandCliInfo,
} from "./issue";
import {
  handler as scopeHandler,
  commandCliInfos as scopeCommandCliInfos,
} from "./scope";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export { listsHandler, checkHandler, issueHandler, scopeHandler };

/** 导出供外部 export 使用，cli 内部不会通过该方法调用各子命令方法 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.LISTS: {
      return listsHandler(argv);
    }
    case SubcommandEnum.CHECK: {
      return checkHandler(argv);
    }
    case SubcommandEnum.ISSUE: {
      return issueHandler(argv);
    }
    case SubcommandEnum.SCOPE: {
      return scopeHandler(argv);
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
    listsCommandCliInfo,
    checkCommandCliInfo,
    issueCommandCliInfo,
    ...scopeCommandCliInfos,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
