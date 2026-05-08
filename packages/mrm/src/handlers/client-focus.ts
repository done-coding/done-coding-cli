import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ClientFocusOptions } from "@/types";
import { focusClient } from "@/services/registry";

export const handler = async (argv: CliHandlerArgv<ClientFocusOptions>) => {
  const { name } = argv;

  try {
    const state = focusClient(name);
    outputConsole.info(
      `已切换 → 当前: ${name} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.CLIENT_FOCUS} <name>`,
  describe: "切换当前 client",
  handler: handler as SubCliInfo["handler"],
};
