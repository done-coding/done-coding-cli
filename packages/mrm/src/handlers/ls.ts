import type {
  CliHandlerArgv,
  YargsOptionsRecord,
  SubCliInfo,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
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
  for (const p of providers) {
    for (const m of p.models) {
      const key = `${m}@${p.alias}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const isCurrent = state.model === m && state.provider === p.alias;
      const star = isCurrent ? " ★" : "";
      const built = p.builtin ? " [内置]" : "";
      outputConsole.info(`${m}${star}    ${p.alias} (${p.protocol})${built}`);
    }
  }
}

/** 树状：provider → 协议 → 模型 */
function showByProvider(
  providers: Provider[],
  state: { provider: string; model: string },
): void {
  for (const p of providers) {
    const currentMark = state.provider === p.alias ? " ★" : "";
    const builtMark = p.builtin ? " [内置]" : "";
    outputConsole.info(`${p.alias}${currentMark} (${p.protocol})${builtMark}`);
    for (const m of p.models) {
      const star = state.model === m && state.provider === p.alias ? " ★" : "";
      const built = isBuiltinModel(p, m) ? " [内置]" : "";
      outputConsole.info(`  ${m}${star}${built}`);
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
