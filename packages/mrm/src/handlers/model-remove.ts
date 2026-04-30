import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ModelRemoveOptions } from "@/types";
import {
  getCurrentClient,
  getCurrentProtocol,
  findProvider,
  removeModel,
} from "@/services/registry";
import { promptConfirm } from "@/utils/prompts";

export const handler = async (argv: CliHandlerArgv<ModelRemoveOptions>) => {
  const { providerAlias, modelName } = argv;
  const clientName = getCurrentClient();
  const protocol = getCurrentProtocol();

  /** 前置校验：provider 和 model 必须存在 */
  const provider = findProvider(protocol, providerAlias);
  if (!provider) {
    outputConsole.error(
      `服务商 "${providerAlias}" 在 ${protocol} 协议下不存在`,
    );
    process.exit(1);
  }
  if (!provider.models.includes(modelName)) {
    outputConsole.error(
      `模型 "${modelName}" 在服务商 "${providerAlias}" 下不存在`,
    );
    process.exit(1);
  }

  const confirmed = await promptConfirm(
    `确认删除模型 "${modelName}"（服务商: "${providerAlias}"）？`,
  );
  if (!confirmed) {
    outputConsole.info("已取消");
    return;
  }

  const state = removeModel({
    protocol,
    clientName,
    providerAlias,
    modelName,
  });
  outputConsole.info(
    `已删除模型 "${modelName}" → 当前: ${clientName} → ${state.provider} → ${state.model}`,
  );
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.MODEL_REMOVE} <providerAlias> <modelName>`,
  describe: "删除服务商的模型",
  handler: handler as SubCliInfo["handler"],
};
