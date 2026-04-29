import type {
  CliHandlerArgv,
  YargsOptionsRecord,
  SubCliInfo,
} from "@done-coding/cli-utils";
import { chalk, outputConsole } from "@done-coding/cli-utils";
import { SubcommandEnum, type LsOptions, type Provider } from "@/types";
import {
  BUILTIN_CLIENTS,
  BUILTIN_PROVIDERS_BY_PROTOCOL,
} from "@/services/presets";
import {
  getCurrentClient,
  getProviders,
  getCurrentProtocol,
  getCurrentState,
} from "@/services/registry";

export const getOptions = (): YargsOptionsRecord<LsOptions> => ({
  view: {
    type: "string",
    choices: ["model", "provider"],
    default: "model",
    describe: "展示视角: model(扁平化) | provider(树状)",
  },
});

export const handler = async (argv: CliHandlerArgv<LsOptions>) => {
  const clientName = getCurrentClient();
  const client = BUILTIN_CLIENTS.find((c) => c.name === clientName);
  if (!client) {
    outputConsole.error(`不支持的 client: ${clientName}`);
    process.exit(1);
  }
  const protocol = getCurrentProtocol();
  const providers = getProviders(protocol);
  const state = getCurrentState();

  if (providers.length === 0) {
    outputConsole.info(`当前 ${protocol} 协议下暂无服务商`);
    return;
  }

  /** 状态行 */
  outputConsole.info(
    `当前: ${clientName} → ${state.provider} → ${state.model}\n`,
  );

  if (argv.view === "provider") {
    showByProvider(providers, state);
  } else {
    showByModel(providers, state);
  }
};

/** 模型扁平化：模型名 + provider + 协议 */
function showByModel(
  providers: Provider[],
  state: { provider: string; model: string },
): void {
  const seen = new Set<string>();
  const lines: {
    isCurrent: boolean;
    model: string;
    prefix: string;
    suffix: string;
  }[] = [];
  let maxModelLen = 0;

  for (const p of providers) {
    for (const m of p.models) {
      const key = `${m}@${p.alias}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const isCurrent = state.model === m && state.provider === p.alias;
      const prefix = `${p.alias} (${p.protocol})`;
      const suffix = p.builtin ? chalk.magenta(" [内置]") : "";
      lines.push({ isCurrent, model: m, prefix, suffix });
      if (m.length > maxModelLen) maxModelLen = m.length;
    }
  }

  for (const { isCurrent, model, prefix, suffix } of lines) {
    const marker = isCurrent ? "*" : " ";
    const text = `${marker} ${model.padEnd(maxModelLen + 2)}${prefix}${suffix}`;
    outputConsole.info(isCurrent ? chalk.green(text) : text);
  }
}

/** 树状：provider → 协议 → 模型 */
function showByProvider(
  providers: Provider[],
  state: { provider: string; model: string },
): void {
  for (const p of providers) {
    const isCurrentProvider = state.provider === p.alias;
    const marker = isCurrentProvider ? "*" : " ";
    const builtTag = p.builtin ? chalk.magenta(" [内置]") : "";
    const provText = `${marker} ${p.alias} (${p.protocol})${builtTag}`;
    outputConsole.info(isCurrentProvider ? chalk.green(provText) : provText);
    for (const m of p.models) {
      const isCurrentModel = state.model === m && state.provider === p.alias;
      const modelMarker = isCurrentModel ? "*" : " ";
      const modelBuilt = isBuiltinModel(p, m) ? chalk.magenta(" [内置]") : "";
      const modelText = `  ${modelMarker} ${m}${modelBuilt}`;
      outputConsole.info(isCurrentModel ? chalk.green(modelText) : modelText);
    }
  }
}

function isBuiltinModel(p: Provider, model: string): boolean {
  if (!p.builtin) return false;
  const builtinList = BUILTIN_PROVIDERS_BY_PROTOCOL[p.protocol];
  const builtin = builtinList.find((bp) => bp.alias === p.alias);
  return builtin?.models.includes(model) ?? false;
}

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.LS,
  describe: "列出可用模型及服务商",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
