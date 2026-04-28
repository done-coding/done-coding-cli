import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ProviderUseOptions } from "@/types";
import { getCurrentClient, switchProvider } from "@/services/registry";
import { writeClientConfig } from "@/services/client-config";

export const handler = async (argv: CliHandlerArgv<ProviderUseOptions>) => {
  const { alias } = argv;
  const clientName = getCurrentClient();

  try {
    const state = switchProvider(clientName, alias);
    outputConsole.info(
      `已切换 → 当前: ${clientName} → ${state.provider} → ${state.model}`,
    );
    /** 写入 client 配置 */
    writeClientConfig(clientName, state);
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.PROVIDER_USE} <alias>`,
  describe: "切换服务商",
  handler: handler as SubCliInfo["handler"],
};
