import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type SwitchOptions } from "@/types";
import { focusClient, getAllClients } from "@/services/registry";

export const handler = async (argv: CliHandlerArgv<SwitchOptions>) => {
  const { client } = argv;

  const allClients = getAllClients();
  if (!allClients.find((c) => c.name === client)) {
    const available = allClients.map((c) => c.name).join(" | ");
    outputConsole.error(`不支持的 client: ${client}，可用: ${available}`);
    process.exit(1);
  }

  try {
    const state = focusClient(client);
    outputConsole.info(
      `已切换 → 当前: ${client} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.SWITCH} <client>`,
  describe: false as unknown as string,
  handler: handler as SubCliInfo["handler"],
};
