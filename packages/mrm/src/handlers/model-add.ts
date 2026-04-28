import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type ModelAddOptions } from "@/types";
import {
  getCurrentClient,
  getCurrentProtocol,
  getCurrentState,
  addModel,
} from "@/services/registry";

export const getOptions = (): YargsOptionsRecord<ModelAddOptions> => ({
  providerAlias: {
    type: "string",
    describe: "服务商别名",
    demandOption: true,
  },
  modelName: {
    type: "string",
    describe: "模型名称",
    demandOption: true,
  },
});

export const handler = async (argv: CliHandlerArgv<ModelAddOptions>) => {
  const { providerAlias, modelName } = argv;
  const clientName = getCurrentClient();
  const protocol = getCurrentProtocol();

  try {
    /** 支持空格分隔的批量输入 */
    const models = modelName.split(/[\s,]+/).filter(Boolean);
    for (const m of models) {
      addModel(protocol, providerAlias, m);
    }
    const state = getCurrentState();
    outputConsole.info(
      `模型添加成功 → 当前: ${clientName} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.MODEL_ADD} <providerAlias> <modelName>`,
  describe: "给服务商添加模型",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
