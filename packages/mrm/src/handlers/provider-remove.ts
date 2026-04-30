import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ProviderRemoveOptions } from "@/types";
import {
  getCurrentClient,
  getCurrentProtocol,
  findProvider,
  removeProvider,
} from "@/services/registry";
import { promptConfirm } from "@/utils/prompts";

export const handler = async (argv: CliHandlerArgv<ProviderRemoveOptions>) => {
  const { alias } = argv;
  const clientName = getCurrentClient();
  const protocol = getCurrentProtocol();

  /** 前置校验：provider 必须存在且非内置 */
  const provider = findProvider(protocol, alias);
  if (!provider) {
    outputConsole.error(`服务商 "${alias}" 不存在`);
    process.exit(1);
  }
  if (provider.builtin) {
    outputConsole.error(`不能删除内置服务商 "${alias}"`);
    process.exit(1);
  }

  const confirmed = await promptConfirm(`确认删除服务商 "${alias}"？`);
  if (!confirmed) {
    outputConsole.info("已取消");
    return;
  }

  const state = removeProvider(clientName, alias);
  outputConsole.info(
    `已删除 "${alias}" → 当前: ${clientName} → ${state.provider} → ${state.model}`,
  );
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.PROVIDER_REMOVE} <alias>`,
  describe: "删除服务商",
  handler: handler as SubCliInfo["handler"],
};
