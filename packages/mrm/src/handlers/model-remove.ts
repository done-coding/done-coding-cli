import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ModelRemoveOptions } from "@/types";
import {
  getCurrentClient,
  getCurrentProtocol,
  removeModel,
} from "@/services/registry";
import { promptConfirm } from "@/utils/prompts";

export const handler = async (argv: CliHandlerArgv<ModelRemoveOptions>) => {
  const { providerAlias, modelName } = argv;
  const clientName = getCurrentClient();
  const protocol = getCurrentProtocol();

  const confirmed = await promptConfirm(
    `确认删除模型 "${modelName}"（服务商: "${providerAlias}"）？`,
  );
  if (!confirmed) {
    outputConsole.info("已取消");
    return;
  }

  try {
    const state = removeModel({
      protocol,
      clientName,
      providerAlias,
      modelName,
    });
    outputConsole.info(
      `已删除模型 "${modelName}" → 当前: ${clientName} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.MODEL_REMOVE} <providerAlias> <modelName>`,
  describe: "删除服务商的模型",
  handler: handler as SubCliInfo["handler"],
};
