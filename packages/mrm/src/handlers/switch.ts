import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, ClientName, type SwitchOptions } from "@/types";
import { switchClient } from "@/services/registry";

export const handler = async (argv: CliHandlerArgv<SwitchOptions>) => {
  const { client } = argv;
  /** 校验 */
  if (
    client !== ClientName.CLAUDE_CODE &&
    client !== ClientName.DONE_CODING_AI
  ) {
    outputConsole.error(
      `不支持的 client: ${client}，合法值: ${Object.values(ClientName).join(" | ")}`,
    );
    process.exit(1);
  }

  try {
    const state = switchClient(client);
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
