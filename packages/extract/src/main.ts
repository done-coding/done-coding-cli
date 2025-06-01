import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import type { CliInfo, SubCliInfo } from "@done-coding/cli-utils";
import { createMainCommand, createSubcommand } from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { moduleName },
} = injectInfo;

const getOptions = (): CliInfo["options"] => {
  return {
    xx: {
      alias: "x",
      describe: "模版测试",
      type: "string",
      demandOption: true,
    },
  };
};

const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  options: getOptions(),
  handler: handler as CliInfo["handler"],
};

/** 分发命令&步骤 */
const dispatchCommandAndUsage = (asSubcommand = false) => {
  const command = asSubcommand ? moduleName : undefined;
  const usage = `$0${asSubcommand ? ` ${moduleName}` : ""} [options]`;
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
