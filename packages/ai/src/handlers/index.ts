import {
  handler as chatHandler,
  commandCliInfo as chatCommandCliInfo,
} from "./chat";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  packDefaultCommandCliInfo,
  type CliInfo,
} from "@done-coding/cli-utils";

export { chatHandler, chatCommandCliInfo };

/** 导出供外部 export使用， cli内部不会通过改方法调用各子命令方法 */
export const handler = async (command: SubcommandEnum) => {
  switch (command) {
    case SubcommandEnum.CHAT: {
      return chatHandler();
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
    packDefaultCommandCliInfo(chatCommandCliInfo),
    chatCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
