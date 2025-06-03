import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import type { CliInfo, SubCliInfo } from "@done-coding/cli-utils";
import { createMainCommand, createSubcommand } from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { moduleName },
} = injectInfo;

const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  options: {
    justCloneFromDoneCoding: {
      alias: "c",
      type: "boolean",
      describe: "是否仅仅(从done-coding系列项目列表中)克隆远程仓库",
      default: false,
    },
  },
  positionals: {
    projectName: {
      describe: "项目名称",
      type: "string",
    },
  },
  handler: handler as CliInfo["handler"],
};

/** 分发命令&步骤 */
const dispatchCommandAndUsage = (asSubcommand = false) => {
  const command = `${asSubcommand ? `${moduleName} ` : ""}[projectName]`;
  const usage = `$0 ${command.trim()}`;
  return { command, usage };
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand({
    ...commandCliInfo,
    ...dispatchCommandAndUsage(),
  });
};

/** 作为子命令创建 */
export const crateAsSubcommand = () => {
  return createSubcommand({
    ...commandCliInfo,
    ...dispatchCommandAndUsage(true),
  } as unknown as SubCliInfo);
};
