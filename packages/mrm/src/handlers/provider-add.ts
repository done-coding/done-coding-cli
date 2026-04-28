import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { outputConsole, xPrompts } from "@done-coding/cli-utils";
import {
  SubcommandEnum,
  type ProviderAddOptions,
  type Provider,
} from "@/types";
import {
  getCurrentClient,
  getCurrentProtocol,
  getCurrentState,
  addProvider,
} from "@/services/registry";
import { promptApiKey } from "@/utils/prompts";

export const getOptions = (): YargsOptionsRecord<ProviderAddOptions> => ({
  alias: {
    type: "string",
    describe: "服务商别名",
    demandOption: true,
  },
  url: {
    type: "string",
    describe: "API 端点地址",
    demandOption: true,
  },
});

export const handler = async (argv: CliHandlerArgv<ProviderAddOptions>) => {
  const { alias, url } = argv;
  const clientName = getCurrentClient();
  const protocol = getCurrentProtocol();

  outputConsole.info(`当前: ${clientName} → 添加服务商到 ${protocol} 协议`);

  const apiKey = await promptApiKey();

  /** 交互式输入模型列表 */
  const { models } = (await xPrompts([
    {
      type: "text",
      name: "models",
      message: "输入该服务商支持的模型（空格或逗号分隔）:",
    },
  ])) as { models: string };

  const modelList = models.split(/[\s,]+/).filter(Boolean);

  if (modelList.length === 0) {
    outputConsole.error("至少需要一个模型");
    process.exit(1);
  }

  const provider: Provider = {
    alias,
    baseUrl: url,
    apiKey,
    models: modelList,
    protocol,
    builtin: false,
  };

  try {
    addProvider(protocol, provider);
    const state = getCurrentState();
    outputConsole.info(
      `服务商 "${alias}" 添加成功 → 当前: ${clientName} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.PROVIDER_ADD} <alias> <url>`,
  describe: "添加服务商",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
