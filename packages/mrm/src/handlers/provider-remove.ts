import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ProviderRemoveOptions } from "@/types";
import { getCurrentClient, removeProvider } from "@/services/registry";
import { promptConfirm } from "@/utils/prompts";

export const handler = async (argv: CliHandlerArgv<ProviderRemoveOptions>) => {
  const { alias } = argv;
  const clientName = getCurrentClient();

  const confirmed = await promptConfirm(`确认删除服务商 "${alias}"？`);
  if (!confirmed) {
    outputConsole.info("已取消");
    return;
  }

  try {
    const state = removeProvider(clientName, alias);
    outputConsole.info(
      `已删除 "${alias}" → 当前: ${clientName} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.PROVIDER_REMOVE} <alias>`,
  describe: "删除服务商",
  handler: handler as SubCliInfo["handler"],
};
