import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import {
  SubcommandEnum,
  type ModelAddOptions,
  type ClientOptions,
} from "@/types";
import {
  getCurrentClient,
  findProvider,
  addModel,
  readRegistry,
} from "@/services/registry";
import { getClientProtocol } from "@/services/presets";

export const getOptions = (): YargsOptionsRecord<
  ModelAddOptions & ClientOptions
> => ({
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
  client: {
    type: "string",
    describe: "指定目标 client",
  },
});

export const handler = async (
  argv: CliHandlerArgv<ModelAddOptions & ClientOptions>,
) => {
  const { providerAlias, modelName } = argv;
  const clientName = argv.client ?? getCurrentClient();
  const protocol = getClientProtocol(clientName);

  /** 前置校验：provider 必须存在 */
  if (!findProvider(protocol, providerAlias)) {
    outputConsole.error(
      `服务商 "${providerAlias}" 在 ${protocol} 协议下不存在`,
    );
    process.exit(1);
  }

  /** 支持空格分隔的批量输入 */
  const models = modelName.split(/[\s,]+/).filter(Boolean);
  for (const m of models) {
    addModel(protocol, providerAlias, m);
  }
  const state = readRegistry().clientState[clientName] ?? {
    provider: "",
    model: "",
  };
  outputConsole.info(
    `模型添加成功 → 当前: ${clientName} → ${state.provider} → ${state.model}`,
  );
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.MODEL_ADD} <providerAlias> <modelName>`,
  describe: "给服务商添加模型",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
