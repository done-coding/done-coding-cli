import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import type { Registry, Provider, ClientState } from "@/types";
import { Protocol, ClientName } from "@/types";
import {
  BUILTIN_CLIENTS,
  BUILTIN_PROVIDERS_BY_PROTOCOL,
  DEFAULT_CLIENT_STATE,
  getClientProtocol,
} from "./presets";

const REGISTRY_DIR = `${homedir()}/.done-coding/mrm`;
const REGISTRY_PATH = `${REGISTRY_DIR}/sources.json`;

/** 获取默认注册表 */
function getDefaultRegistry(): Registry {
  const clientState: Record<string, ClientState> = {};
  for (const client of BUILTIN_CLIENTS) {
    const def = DEFAULT_CLIENT_STATE[client.name];
    clientState[client.name] = {
      provider: def?.provider ?? "",
      model: def?.model ?? "",
    };
  }
  return {
    currentClient: ClientName.CLAUDE_CODE,
    clientState,
    providers: structuredClone(BUILTIN_PROVIDERS_BY_PROTOCOL),
  };
}

/** 读取注册表 */
export function readRegistry(): Registry {
  try {
    if (!existsSync(REGISTRY_PATH)) {
      const def = getDefaultRegistry();
      writeRegistry(def);
      return def;
    }
    const data = readFileSync(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(data) as Registry;
    /** 补齐可能新增的内置 provider */
    return mergeBuiltins(parsed);
  } catch {
    return getDefaultRegistry();
  }
}

/** 写入注册表 */
export function writeRegistry(registry: Registry): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

/** 补齐内置 provider（升级场景） */
function mergeBuiltins(registry: Registry): Registry {
  const merged = structuredClone(registry);
  for (const proto of [Protocol.ANTHROPIC, Protocol.OPENAI]) {
    if (!merged.providers[proto]) {
      merged.providers[proto] = [];
    }
    for (const builtin of BUILTIN_PROVIDERS_BY_PROTOCOL[proto]) {
      const exists = merged.providers[proto].find(
        (p) => p.alias === builtin.alias,
      );
      if (!exists) {
        merged.providers[proto].push(structuredClone(builtin));
      }
    }
  }
  /** 补齐 clientState */
  for (const client of BUILTIN_CLIENTS) {
    if (!merged.clientState[client.name]) {
      const def = DEFAULT_CLIENT_STATE[client.name];
      merged.clientState[client.name] = {
        provider: def?.provider ?? "",
        model: def?.model ?? "",
      };
    }
  }
  return merged;
}

/** 获取当前 client */
export function getCurrentClient(): string {
  return readRegistry().currentClient;
}

/** 获取当前 protocol 下的 provider 列表 */
export function getProviders(protocol?: Protocol): Provider[] {
  const registry = readRegistry();
  const proto = protocol ?? getCurrentProtocol();
  return registry.providers[proto] ?? [];
}

/** 获取当前 client 的 protocol */
export function getCurrentProtocol(): Protocol {
  const registry = readRegistry();
  const client = BUILTIN_CLIENTS.find((c) => c.name === registry.currentClient);
  if (!client) throw new Error(`不支持的 client: ${registry.currentClient}`);
  return client.protocol;
}

/** 获取当前 client 状态 */
export function getCurrentState(): ClientState {
  const registry = readRegistry();
  return (
    registry.clientState[registry.currentClient] ?? {
      provider: "",
      model: "",
    }
  );
}

// ===== Client 操作 =====

/** 切换 client */
export function switchClient(clientName: string): ClientState {
  const registry = readRegistry();
  if (!BUILTIN_CLIENTS.find((c) => c.name === clientName)) {
    throw new Error(
      `不支持的 client: ${clientName}，合法值: ${Object.values(ClientName).join(" | ")}`,
    );
  }
  registry.currentClient = clientName;

  /** 确保目标 client 有状态 */
  if (!registry.clientState[clientName]) {
    const def = DEFAULT_CLIENT_STATE[clientName];
    registry.clientState[clientName] = {
      provider: def?.provider ?? "",
      model: def?.model ?? "",
    };
  }

  writeRegistry(registry);
  return registry.clientState[clientName];
}

// ===== Provider 操作 =====

/** 查找 provider */
export function findProvider(
  protocol: Protocol,
  alias: string,
): Provider | undefined {
  const providers = getProviders(protocol);
  return providers.find((p) => p.alias === alias);
}

/** 添加 provider */
export function addProvider(protocol: Protocol, provider: Provider): void {
  const registry = readRegistry();
  const providers = registry.providers[protocol] ?? [];
  if (providers.find((p) => p.alias === provider.alias)) {
    throw new Error(`服务商 "${provider.alias}" 在 ${protocol} 协议下已存在`);
  }
  providers.push(provider);
  registry.providers[protocol] = providers;
  writeRegistry(registry);
}

/** 切换 provider */
export function switchProvider(clientName: string, alias: string): ClientState {
  const registry = readRegistry();
  const protocol = getClientProtocol(clientName as ClientName);
  const provider = findProvider(protocol, alias);
  if (!provider) {
    throw new Error(`服务商 "${alias}" 在 ${protocol} 协议下不存在`);
  }
  if (!provider.models.length) {
    throw new Error(`服务商 "${alias}" 下无可用模型`);
  }

  registry.clientState[clientName] = {
    provider: alias,
    model: provider.models[0],
  };
  writeRegistry(registry);
  return registry.clientState[clientName];
}

/** 删除 provider */
export function removeProvider(clientName: string, alias: string): ClientState {
  const registry = readRegistry();
  const protocol = getClientProtocol(clientName as ClientName);
  const providers = registry.providers[protocol] ?? [];
  const idx = providers.findIndex((p) => p.alias === alias);
  if (idx < 0) {
    throw new Error(`服务商 "${alias}" 不存在`);
  }
  if (providers[idx].builtin) {
    throw new Error(`不能删除内置服务商 "${alias}"`);
  }

  providers.splice(idx, 1);
  registry.providers[protocol] = providers;

  /** 如果删除的是当前使用的 provider，回退到默认 */
  const state = registry.clientState[clientName];
  if (state && state.provider === alias) {
    const def = DEFAULT_CLIENT_STATE[clientName];
    const defaultProvider = providers[0];
    state.provider = defaultProvider?.alias ?? def?.provider ?? "";
    state.model = defaultProvider?.models[0] ?? def?.model ?? "";
  }

  writeRegistry(registry);
  return registry.clientState[clientName];
}

// ===== Model 操作 =====

/** 添加模型到 provider */
export function addModel(
  protocol: Protocol,
  providerAlias: string,
  modelName: string,
): void {
  const registry = readRegistry();
  const provider = findProvider(protocol, providerAlias);
  if (!provider) {
    throw new Error(`服务商 "${providerAlias}" 不存在`);
  }
  if (provider.models.includes(modelName)) {
    throw new Error(`模型 "${modelName}" 在服务商 "${providerAlias}" 下已存在`);
  }
  provider.models.push(modelName);
  writeRegistry(registry);
}

/** 删除 provider 下的模型 */
export function removeModel(opts: {
  protocol: Protocol;
  clientName: string;
  providerAlias: string;
  modelName: string;
}): ClientState {
  const { protocol, clientName, providerAlias, modelName } = opts;
  const registry = readRegistry();
  const provider = findProvider(protocol, providerAlias);
  if (!provider) {
    throw new Error(`服务商 "${providerAlias}" 不存在`);
  }

  const idx = provider.models.indexOf(modelName);
  if (idx < 0) {
    throw new Error(`模型 "${modelName}" 在服务商 "${providerAlias}" 下不存在`);
  }

  /** 内置 provider 的内置模型不可删除 */
  if (provider.builtin) {
    const builtinProvider = BUILTIN_PROVIDERS_BY_PROTOCOL[protocol].find(
      (p) => p.alias === providerAlias,
    );
    if (builtinProvider?.models.includes(modelName)) {
      throw new Error(`不能删除内置模型 "${modelName}"`);
    }
  }

  provider.models.splice(idx, 1);

  if (!provider.models.length) {
    throw new Error(`服务商 "${providerAlias}" 下必须有至少一个模型`);
  }

  /** 如果删除的是当前使用的模型，回退到该 provider 的第一个模型 */
  const state = registry.clientState[clientName];
  if (state && state.provider === providerAlias && state.model === modelName) {
    state.model = provider.models[0];
  }

  writeRegistry(registry);
  return registry.clientState[clientName];
}

/** 切换模型 */
export function switchModel(
  clientName: string,
  modelName: string,
  targetProviderAlias?: string,
): ClientState {
  const registry = readRegistry();
  const protocol = getClientProtocol(clientName as ClientName);
  const state = registry.clientState[clientName];
  if (!state) {
    throw new Error(`client "${clientName}" 未初始化`);
  }

  /** IF --provider 指定，先切 provider */
  if (targetProviderAlias) {
    const provider = findProvider(protocol, targetProviderAlias);
    if (!provider) {
      throw new Error(
        `服务商 "${targetProviderAlias}" 在 ${protocol} 协议下不存在`,
      );
    }
    if (!provider.models.includes(modelName)) {
      throw new Error(
        `模型 "${modelName}" 在服务商 "${targetProviderAlias}" 下不存在`,
      );
    }
    state.provider = targetProviderAlias;
    state.model = modelName;
  } else {
    /** 在当前 provider 下查找 */
    const provider = findProvider(protocol, state.provider);
    if (!provider) {
      throw new Error(`当前服务商 "${state.provider}" 不存在`);
    }
    if (!provider.models.includes(modelName)) {
      throw new Error(
        `模型 "${modelName}" 在服务商 "${state.provider}" 下不存在，可用: ${provider.models.join(", ")}`,
      );
    }
    state.model = modelName;
  }

  registry.clientState[clientName] = state;
  writeRegistry(registry);
  return state;
}
