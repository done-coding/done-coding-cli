import {
  handler as initHandler,
  commandCliInfo as initCommandCliInfo,
} from "./init";
import {
  handler as compileHandler,
  commandCliInfo as compileCommandCliInfo,
} from "./compile";
import {
  handler as batchCompileHandler,
  commandCliInfo as batchCompileCommandCliInfo,
} from "./batch-compile";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

/** template 包 handler 导出 */
export {
  initHandler,
  initCommandCliInfo,
  compileHandler,
  compileCommandCliInfo,
  batchCompileHandler,
};

/** collectEnvDataForm 归一化工具导出 */
export { normalizeCollectEnvDataForm } from "./batch-compile";

/** collectEnvDataForm 归一化问题类型导出 */
export type { CollectEnvDataQuestion } from "./batch-compile";

/** template 包根 handler */
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
    case SubcommandEnum.BATCH: {
      return batchCompileHandler(argv);
    }
    default: {
      throw new Error(`不支持的命令 ${command}`);
    }
  }
};

const { version, description: describe } = injectInfo;

/** template 包根命令配置 */
export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [
    initCommandCliInfo,
    compileCommandCliInfo,
    batchCompileCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
