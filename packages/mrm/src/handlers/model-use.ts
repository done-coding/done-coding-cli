import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ModelUseOptions } from "@/types";
import { getCurrentClient, switchModel } from "@/services/registry";
import { writeClientConfig } from "@/services/client-config";

export const handler = async (argv: CliHandlerArgv<ModelUseOptions>) => {
  const { model, provider } = argv;
  const clientName = getCurrentClient();

  try {
    const state = switchModel(clientName, model, provider);
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

/** model use 的 options（轻量，仅 --provider） */
export const getModelUseOptions = (): YargsOptionsRecord<ModelUseOptions> => ({
  model: {
    type: "string",
    describe: "模型名称",
    demandOption: true,
  },
  provider: {
    type: "string",
    alias: "p",
    describe: "指定服务商别名（可选）",
  },
});

/** model use 命令 */
export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.MODEL_USE} <model>`,
  describe: "切换模型",
  options: getModelUseOptions(),
  handler: handler as SubCliInfo["handler"],
};

/** use 快捷命令（同 model use） */
export const useCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.USE} <model>`,
  describe: "切换模型（快捷命令）",
  options: getModelUseOptions(),
  handler: handler as SubCliInfo["handler"],
};
