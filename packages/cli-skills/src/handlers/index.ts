import {
  handler as testHandler,
  commandCliInfo as testCommandCliInfo,
} from "./test";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export { testHandler, testCommandCliInfo };

/** 导出供外部 export使用， cli内部不会通过改方法调用各子命令方法 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.TEST: {
      return testHandler(argv);
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
  subcommands: [testCommandCliInfo].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
