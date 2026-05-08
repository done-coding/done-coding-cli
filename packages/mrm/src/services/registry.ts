import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Registry, Provider, ClientState, Client } from "@/types";
import { Protocol, ClientName } from "@/types";
import {
  BUILTIN_CLIENTS,
  BUILTIN_PROVIDERS_BY_PROTOCOL,
  DEFAULT_CLIENT_STATE,
} from "./presets";
import {
  getMrmConfigDirPath,
  getAiConfigFilePath,
} from "@done-coding/cli-utils";

// ===== 文件路径 =====

function clientsPath(): string {
  return path.join(getMrmConfigDirPath(), "clients.json");
}

function registryPath(): string {
  return path.join(getMrmConfigDirPath(), "registry.json");
}

function providerPath(protocol: Protocol): string {
  return path.join(getMrmConfigDirPath(), "providers", `${protocol}.json`);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ===== 文件级读写 =====

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readClientsFile(): Client[] {
  return readJsonFile<Client[]>(clientsPath(), []);
}

function writeClientsFile(clients: Client[]): void {
  writeJsonFile(clientsPath(), clients);
}

function readRegistryFile(): {
  currentClient: string;
  clientState: Record<string, ClientState>;
} {
  return readJsonFile(registryPath(), {
    currentClient: ClientName.CLAUDE_CODE,
    clientState: {},
  });
}

function writeRegistryFile(data: {
  currentClient: string;
  clientState: Record<string, ClientState>;
}): void {
  writeJsonFile(registryPath(), data);
}

function readProvidersFile(protocol: Protocol): Provider[] {
  return readJsonFile<Provider[]>(providerPath(protocol), []);
}

function writeProvidersFile(protocol: Protocol, providers: Provider[]): void {
  writeJsonFile(providerPath(protocol), providers);
}

// ===== 合并 builtin + 自定义 client =====

function mergeClientsWithBuiltins(persistedClients: Client[]): Client[] {
  const result = [...BUILTIN_CLIENTS];
  for (const c of persistedClients) {
    if (!result.find((b) => b.name === c.name)) {
      result.push(c);
    }
  }
  return result;
}

// ===== 加载所有协议 provider =====

function loadAllProviders(): Record<Protocol, Provider[]> {
  const result: Record<Protocol, Provider[]> = {
    [Protocol.ANTHROPIC]: [],
    [Protocol.OPENAI]: [],
  };
  for (const proto of [Protocol.ANTHROPIC, Protocol.OPENAI]) {
    const persisted = readProvidersFile(proto);
    // 补齐内置 provider
    const merged = mergeProvidersWithBuiltins(proto, persisted);
    result[proto] = merged;
  }
  return result;
}

function mergeProvidersWithBuiltins(
  protocol: Protocol,
  persisted: Provider[],
): Provider[] {
  const result = [...persisted];
  for (const builtin of BUILTIN_PROVIDERS_BY_PROTOCOL[protocol]) {
    if (!result.find((p) => p.alias === builtin.alias)) {
      result.push(structuredClone(builtin));
    }
  }
  return result;
}

// ===== 协议解析 =====

/** 解析 client 的实际协议（done-coding-ai 从 AI 配置文件动态检测） */
export function resolveClientProtocol(clientName: string): Protocol {
  if (clientName === ClientName.DONE_CODING_AI) {
    const aiPath = getAiConfigFilePath();
    try {
      if (existsSync(aiPath)) {
        const aiConfig = JSON.parse(readFileSync(aiPath, "utf-8")) as Record<
          string,
          unknown
        >;
        const proto = aiConfig.protocol;
        if (proto === Protocol.ANTHROPIC) return Protocol.ANTHROPIC;
        if (proto === Protocol.OPENAI) return Protocol.OPENAI;
      }
    } catch (_) {
      /* 文件损坏回退 */
    }
    return Protocol.OPENAI;
  }

  const client = getAllClients().find((c) => c.name === clientName);
  if (!client) throw new Error(`不支持的 client: ${clientName}`);
  return client.protocol;
}

// ===== 获取 client 默认状态 =====

function getDefaultStateForClient(client: Client): ClientState {
  // 优先使用 DEFAULT_CLIENT_STATE 中定义的默认值
  const def = DEFAULT_CLIENT_STATE[client.name];
  if (def) return { provider: def.provider, model: def.model };

  // 自定义 client：取协议下第一个 provider 的第一个 model
  const protocol =
    client.name === ClientName.DONE_CODING_AI
      ? resolveClientProtocol(client.name)
      : client.protocol;

  const builtinProviders = BUILTIN_PROVIDERS_BY_PROTOCOL[protocol];
  const defaultAlias = builtinProviders[0]?.alias ?? "";
  const defaultModel = builtinProviders[0]?.models[0] ?? "";

  return { provider: defaultAlias, model: defaultModel };
}

// ===== 获取所有已注册 client =====

export function getAllClients(): Client[] {
  return readRegistry().clients;
}

// ===== 读写注册表 =====

/** 读取注册表 */
export function readRegistry(): Registry {
  const needInit = !existsSync(clientsPath()) || !existsSync(registryPath());

  const persistedClients = readClientsFile();
  const persistedRegistry = readRegistryFile();

  const allClients = mergeClientsWithBuiltins(persistedClients);

  // 补齐 clientState
  for (const client of allClients) {
    if (!persistedRegistry.clientState[client.name]) {
      persistedRegistry.clientState[client.name] =
        getDefaultStateForClient(client);
    }
  }

  // 补齐内置 provider
  const providers = loadAllProviders();

  const registry: Registry = {
    currentClient: persistedRegistry.currentClient,
    clientState: persistedRegistry.clientState,
    clients: allClients,
    providers,
  };

  // 首次使用时自动创建完整目录结构
  if (needInit) {
    writeRegistry(registry);
  }

  return registry;
}

/** 写入注册表 */
export function writeRegistry(registry: Registry): void {
  // 仅持久化自定义 client（非内置）
  const customClients = registry.clients.filter((c) => !c.builtin);
  writeClientsFile(customClients);

  // 持久化注册状态
  writeRegistryFile({
    currentClient: registry.currentClient,
    clientState: registry.clientState,
  });

  // 持久化 provider（按协议拆分）
  for (const proto of [Protocol.ANTHROPIC, Protocol.OPENAI]) {
    writeProvidersFile(proto, registry.providers[proto] ?? []);
  }
}

// ===== Client 操作 =====

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
  return resolveClientProtocol(registry.currentClient);
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

/** 切换 client */
export function switchClient(clientName: string): ClientState {
  const registry = readRegistry();
  const client = registry.clients.find((c) => c.name === clientName);
  if (!client) {
    const available = registry.clients.map((c) => c.name).join(" | ");
    throw new Error(`不支持的 client: ${clientName}，可用: ${available}`);
  }
  registry.currentClient = clientName;

  if (!registry.clientState[clientName]) {
    registry.clientState[clientName] = getDefaultStateForClient(client);
  }

  writeRegistry(registry);
  return registry.clientState[clientName];
}

/** 添加自定义 client */
export function addClient(client: Client): void {
  const registry = readRegistry();

  if (registry.clients.find((c) => c.name === client.name)) {
    throw new Error(`client: ${client.name} 已存在`);
  }

  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(client.name)) {
    throw new Error(
      `client 名称必须为 kebab-case 格式（小写字母、数字、连字符），不能以连字符开头或结尾`,
    );
  }

  registry.clients.push(client);

  registry.clientState[client.name] = getDefaultStateForClient(client);

  writeRegistry(registry);
}

/** 删除自定义 client */
export function removeClient(name: string): void {
  const registry = readRegistry();
  const client = registry.clients.find((c) => c.name === name);

  if (!client) {
    throw new Error(`client: ${name} 不存在`);
  }

  if (client.builtin) {
    throw new Error(`不能删除内置 client: ${name}`);
  }

  registry.clients = registry.clients.filter((c) => c.name !== name);
  delete registry.clientState[name];

  if (registry.currentClient === name) {
    registry.currentClient = ClientName.CLAUDE_CODE;
    if (!registry.clientState[ClientName.CLAUDE_CODE]) {
      const cc = registry.clients.find(
        (c) => c.name === ClientName.CLAUDE_CODE,
      );
      if (cc) {
        registry.clientState[ClientName.CLAUDE_CODE] =
          getDefaultStateForClient(cc);
      }
    }
  }

  writeRegistry(registry);
}

/** 切换当前 client（focus） */
export function focusClient(name: string): ClientState {
  const registry = readRegistry();
  const client = registry.clients.find((c) => c.name === name);

  if (!client) {
    const available = registry.clients.map((c) => c.name).join(", ");
    throw new Error(`client: ${name} 不存在，可用: ${available}`);
  }

  registry.currentClient = name;

  if (!registry.clientState[name]) {
    registry.clientState[name] = getDefaultStateForClient(client);
  }

  writeRegistry(registry);
  return registry.clientState[name];
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
export function switchProvider(
  clientName: string,
  alias: string,
  protocolOverride?: Protocol,
): ClientState {
  const registry = readRegistry();
  const protocol = protocolOverride ?? resolveClientProtocol(clientName);
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
  const protocol = resolveClientProtocol(clientName);
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
  const providers = registry.providers[protocol] ?? [];
  const provider = providers.find((p) => p.alias === providerAlias);
  if (!provider) {
    throw new Error(`服务商 "${providerAlias}" 不存在`);
  }
  if (provider.models.includes(modelName)) {
    throw new Error(`模型 "${modelName}" 在服务商 "${providerAlias}" 下已存在`);
  }
  provider.models.push(modelName);
  writeRegistry(registry);
}

/** 设置 provider 的 apiKey */
export function setProviderApiKey(
  protocol: Protocol,
  alias: string,
  apiKey: string,
): void {
  const registry = readRegistry();
  const providers = registry.providers[protocol] ?? [];
  const provider = providers.find((p) => p.alias === alias);
  if (!provider) {
    throw new Error(`服务商 "${alias}" 在 ${protocol} 协议下不存在`);
  }
  provider.apiKey = apiKey;
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
  const providers = registry.providers[protocol] ?? [];
  const provider = providers.find((p) => p.alias === providerAlias);
  if (!provider) {
    throw new Error(`服务商 "${providerAlias}" 不存在`);
  }

  const idx = provider.models.indexOf(modelName);
  if (idx < 0) {
    throw new Error(`模型 "${modelName}" 在服务商 "${providerAlias}" 下不存在`);
  }

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
  opts?: {
    targetProviderAlias?: string;
    protocolOverride?: Protocol;
  },
): ClientState {
  const registry = readRegistry();
  const targetProviderAlias = opts?.targetProviderAlias;
  const protocol = opts?.protocolOverride ?? resolveClientProtocol(clientName);
  const state = registry.clientState[clientName];
  if (!state) {
    throw new Error(`client "${clientName}" 未初始化`);
  }

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
