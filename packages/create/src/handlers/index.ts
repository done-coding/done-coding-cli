import {
  handler as createHandler,
  commandCliInfo as createCommandCliInfo,
  prepareCreateProject,
  completeCreateProject,
} from "./create";
import { instancesCommandCliInfo } from "./instances";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

/** create 包 handler 导出 */
export {
  createHandler,
  createCommandCliInfo,
  prepareCreateProject,
  completeCreateProject,
};

/** create 包根 handler */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.CREATE:
    default: {
      return createHandler(argv);
    }
  }
};

const { version, description: describe } = injectInfo;

/** create 包根命令配置 */
export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [createCommandCliInfo, instancesCommandCliInfo].map(
    createSubcommand,
  ),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
