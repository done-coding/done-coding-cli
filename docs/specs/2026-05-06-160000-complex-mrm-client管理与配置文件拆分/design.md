---
任务等级: Complex
日期: 2026-05-06
审核状态: 已通过
reviewer: PM + 架构师 + superpowers:code-reviewer + 上下游预审（开发/测试/产品）
审核日期: 2026-05-07
---

# 技术设计文档：mrm Client 管理与配置文件拆分

## 变更范围

- **Direct Targets**：
  - `packages/utils/src/const.ts` — 新增 AI 配置和 mrm 目录路径常量
  - `packages/utils/src/cli-config.ts` — 拆分 AiConfig 类型，新增 AI 配置读写方法，移除 DoneCodingCliGlobalConfig 中 AI_CONFIG 字段
  - `packages/mrm/src/types/index.ts` — Client 接口加 builtin 字段和 name 类型放宽；新增 client 管理子命令枚举和 options
  - `packages/mrm/src/services/presets.ts` — done-coding-ai 协议改为动态检测；configPath 更新；Client 加 builtin 字段
  - `packages/mrm/src/services/registry.ts` — 读写从单文件改为目录结构；新增 client CRUD；协议检测改为动态
  - `packages/mrm/src/services/client-config.ts` — 写入路径改为 ai/config.json；增加 protocol 字段写入；支持用户自定义 client 的通用写入
  - `packages/mrm/src/handlers/index.ts` — 注册新的 client 子命令
  - `packages/mrm/src/handlers/client-add.ts` — 新增
  - `packages/mrm/src/handlers/client-remove.ts` — 新增
  - `packages/mrm/src/handlers/client-focus.ts` — 新增
  - `packages/mrm/src/handlers/switch.ts` — 校验改为动态 client 列表；保留为 focus 别名
  - `packages/mrm/src/handlers/ls.ts` — --client 选项从固定枚举改为动态 client 列表
  - `packages/mrm/src/index.ts` — 导出新增的 client 管理方法
  - `packages/ai/src/handlers/chat.ts` — 配置读写路径改为 ai/config.json；移除对 DoneCodingCliGlobalConfig 的 AI_CONFIG 访问

- **Collateral Reads**：
  - `packages/utils/src/index.ts` — 确认导出链完整
  - `packages/mrm/src/handlers/model-use.ts` — 确认 --client 选项 source
  - `packages/mrm/src/handlers/provider-add.ts` — 确认 --client 选项 source
  - `packages/mrm/src/main.ts` — 确认 CLI 注册模式（不改）

- **Out-of-Scope**：
  - 旧格式自动迁移逻辑（明确不做）
  - Provider/model 管理命令行为变更（仅内部路径调整）
  - Claude Code 配置写入逻辑（不涉及）
  - 其他子包（component/config/create/extract/inject/publish/template）

## 关键技术点

### 1. 配置文件路径重构（utils 包）

#### 1.1 新增路径常量（`packages/utils/src/const.ts`）

```ts
/** done-coding AI 配置相对路径 */
export const DONE_CODING_AI_CONFIG_RELATIVE_PATH = `${DONE_CODING_CONFIG_RELATIVE_DIR}/ai/config.json`;

/** done-coding mrm 数据目录相对路径 */
export const DONE_CODING_MRM_CONFIG_RELATIVE_DIR = `${DONE_CODING_CONFIG_RELATIVE_DIR}/mrm`;
```

`DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH` 保留不变，路径仍为 `.done-coding/config.json`，但用途收敛为仅读写全局配置（ASSETS_CONFIG_REPO_URL）。

#### 1.2 类型与函数重构（`packages/utils/src/cli-config.ts`）

**AiConfig 类型独立**（保留在 `cli-config.ts`，不与全局 config 耦合）：

```ts
export interface AiConfig {
  protocol?: string;   // "openai" | "anthropic"，默认 "openai"
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}
```

注意：`model/apiKey/baseUrl` 从必填改为可选——`readAiConfig()` 在文件不存在时返回空对象，调用方自行处理缺失字段。

**DoneCodingCliGlobalConfig 精简**：

```ts
export enum DoneCodingCliGlobalConfigKeyEnum {
  ASSETS_CONFIG_REPO_URL = "ASSETS_CONFIG_REPO_URL",
  // 移除 AI_CONFIG = "AI_CONFIG"
}

export interface DoneCodingCliGlobalConfig {
  [DoneCodingCliGlobalConfigKeyEnum.ASSETS_CONFIG_REPO_URL]: string;
  // 移除 [DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG]?: AiConfig;
}
```

**新增 AI 配置路径和读写方法**：

```ts
/** 获取 AI 配置文件路径 */
export const getAiConfigFilePath = (): string => {
  return path.resolve(homedir(), DONE_CODING_AI_CONFIG_RELATIVE_PATH);
};

/** 获取 mrm 数据目录路径 */
export const getMrmConfigDirPath = (): string => {
  return path.resolve(homedir(), DONE_CODING_MRM_CONFIG_RELATIVE_DIR);
};

/** 读取 AI 配置，文件不存在时返回空对象 */
export const readAiConfig = async (): Promise<AiConfig> => {
  const filePath = getAiConfigFilePath();
  try {
    if (await assetIsExitsAsync(filePath)) {
      return await readJsonFileAsync<AiConfig>(filePath, {});
    }
  } catch (_) { /* 文件损坏等异常，返回默认 */ }
  return {};
};

/** 写入 AI 配置（浅合并：保留已有非 mrm 字段） */
export const writeAiConfig = async (config: Partial<AiConfig>): Promise<void> => {
  const filePath = getAiConfigFilePath();
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // 浅合并：读取已有内容，合并写入
  const existing = await readAiConfig();
  const merged = { ...existing, ...config };
  writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
};
```

**旧字段检测与告警**：

`getGlobalConfigFilePath()` 关联的 `readGlobalConfig` 内部行为不变（文件路径不变），但在 utils 包中新增一个工具方法供 mrm 启动时检测旧格式：

```ts
/** 检测旧配置格式并输出一次性 warning */
export const checkLegacyAiConfig = async (): Promise<void> => {
  const globalPath = getGlobalConfigFilePath();
  const aiPath = getAiConfigFilePath();
  
  // 仅在 AI 配置新文件尚不存在时检测
  if (await assetIsExitsAsync(aiPath)) return;
  if (!(await assetIsExitsAsync(globalPath))) return;
  
  try {
    const global = await readJsonFileAsync<Record<string, unknown>>(globalPath, {});
    if ("AI_CONFIG" in global) {
      process.stderr.write(
        "[WARN] 检测到 ~/.done-coding/config.json 包含旧的 AI_CONFIG 字段，" +
        "该字段已迁移到 ~/.done-coding/ai/config.json。请手动迁移后删除旧字段。\n"
      );
    }
  } catch (_) { /* 读取失败静默 */ }
};
```

### 2. mrm 数据目录化（`packages/mrm/src/services/registry.ts` 重写）

#### 2.1 目录结构

```
~/.done-coding/mrm/
├── clients.json            ← Client[] 数组
├── registry.json           ← { currentClient: string, clientState: Record<string, ClientState> }
└── providers/
    ├── anthropic.json      ← Provider[]
    └── openai.json         ← Provider[]
```

#### 2.2 类型定义（`packages/mrm/src/types/index.ts` 变更）

```ts
// Client 接口变更：name 从 ClientName 改为 string，新增 builtin
export interface Client {
  name: string;          // was: ClientName
  protocol: Protocol;
  configPath: string;
  builtin: boolean;      // NEW
}

// ClientName 枚举保留，用于代码中引用内置 client
export enum ClientName {
  CLAUDE_CODE = "claude-code",
  DONE_CODING_AI = "done-coding-ai",
}

// SubcommandEnum 新增
export enum SubcommandEnum {
  // ... existing ...
  CLIENT_ADD = "client add",
  CLIENT_REMOVE = "client remove",
  CLIENT_FOCUS = "client focus",
}

// 新增 options
export interface ClientAddOptions {
  name: string;
  protocol: Protocol;
  configPath: string;
}

export interface ClientRemoveOptions {
  name: string;
}

export interface ClientFocusOptions {
  name: string;
}
```

`Registry` 内部类型新增 `clients` 字段：

```ts
export interface Registry {
  currentClient: string;
  clientState: Record<string, ClientState>;
  clients: Client[];                        // NEW: 从 clients.json 加载的自定义 client
  providers: Record<Protocol, Provider[]>;
}
```

#### 2.3 文件级读写函数

```ts
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

// ===== clients.json =====

function readClientsFile(): Client[] {
  try {
    if (!existsSync(clientsPath())) return [];
    return readJsonFile<Client[]>(clientsPath(), []);
  } catch {
    return [];
  }
}

function writeClientsFile(clients: Client[]): void {
  ensureDir(getMrmConfigDirPath());
  writeFileSync(clientsPath(), JSON.stringify(clients, null, 2), "utf-8");
}

// ===== registry.json =====

function readRegistryFile(): { currentClient: string; clientState: Record<string, ClientState> } {
  const def = { currentClient: ClientName.CLAUDE_CODE, clientState: {} };
  try {
    if (!existsSync(registryPath())) return def;
    return { ...def, ...readJsonFile<typeof def>(registryPath(), def) };
  } catch {
    return def;
  }
}

function writeRegistryFile(data: { currentClient: string; clientState: Record<string, ClientState> }): void {
  ensureDir(getMrmConfigDirPath());
  writeFileSync(registryPath(), JSON.stringify(data, null, 2), "utf-8");
}

// ===== providers/<proto>.json =====

function readProvidersFile(protocol: Protocol): Provider[] {
  try {
    if (!existsSync(providerPath(protocol))) return [];
    return readJsonFile<Provider[]>(providerPath(protocol), []);
  } catch {
    return [];
  }
}

function writeProvidersFile(protocol: Protocol, providers: Provider[]): void {
  ensureDir(path.join(getMrmConfigDirPath(), "providers"));
  writeFileSync(providerPath(protocol), JSON.stringify(providers, null, 2), "utf-8");
}
```

#### 2.4 `readRegistry()` 重写

```ts
export function readRegistry(): Registry {
  const persistedClients = readClientsFile();
  const persistedRegistry = readRegistryFile();
  
  // 合并所有 client（内置 + 持久化自定义）
  const allClients = mergeClientsWithBuiltins(persistedClients);
  
  // 补齐 clientState（新 client 或升级场景）
  for (const client of allClients) {
    if (!persistedRegistry.clientState[client.name]) {
      persistedRegistry.clientState[client.name] = getDefaultStateForClient(client);
    }
  }
  
  // 补齐内置 provider（升级场景）
  const providers = loadAllProviders();
  
  return {
    currentClient: persistedRegistry.currentClient,
    clientState: persistedRegistry.clientState,
    clients: allClients,
    providers,
  };
}
```

#### 2.5 `writeRegistry()` 改为全量持久化

```ts
export function writeRegistry(registry: Registry): void {
  // 仅持久化自定义 client（非内置）
  const customClients = registry.clients.filter(c => !c.builtin);
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
```

#### 2.6 协议解析：动态检测 done-coding-ai

```ts
import { readAiConfig } from "@done-coding/cli-utils";

/** 获取所有已注册 client（内置 + 自定义） */
export function getAllClients(): Client[] {
  return readRegistry().clients;
}

/** 解析 client 的实际协议（done-coding-ai 从 AI 配置文件动态检测） */
export function resolveClientProtocol(clientName: string): Protocol {
  if (clientName === ClientName.DONE_CODING_AI) {
    // 同步读取 AI 配置（readFileSync，registry 整体是同步的）
    const aiPath = getAiConfigFilePath();
    try {
      if (existsSync(aiPath)) {
        const aiConfig = JSON.parse(readFileSync(aiPath, "utf-8")) as AiConfig;
        const proto = aiConfig.protocol;
        if (proto === Protocol.ANTHROPIC) return Protocol.ANTHROPIC;
        if (proto === Protocol.OPENAI) return Protocol.OPENAI;
        // 非法值回退
        return Protocol.OPENAI;
      }
    } catch (_) { /* 文件损坏回退 */ }
    return Protocol.OPENAI;
  }
  
  // 其他 client（含用户自定义）从 client 定义中取 protocol
  const client = getAllClients().find(c => c.name === clientName);
  if (!client) throw new Error(`不支持的 client: ${clientName}`);
  return client.protocol;
}
```

注意：`readFileSync` 调用点在 registry 模块中保持同步范式（现有 registry 全部为同步 API）。`readAiConfig`（async）用于 AI 包自己的 handler 流程。

#### 2.7 `getCurrentProtocol()` 改为动态解析

```ts
export function getCurrentProtocol(): Protocol {
  const registry = readRegistry();
  return resolveClientProtocol(registry.currentClient);
}
```

#### 2.8 其他受影响的 registry 函数

- `switchClient()`：校验从 `BUILTIN_CLIENTS.find(...)` 改为 `getAllClients().find(...)`
- `getProviders()`：不变（签名和逻辑不变，仅内部使用新的 `readRegistry()`）
- `switchProvider()`：`getClientProtocol()` 调用改为 `resolveClientProtocol()`
- `removeProvider()`：同上
- `switchModel()`：同上

#### 2.9 新增 Client CRUD

```ts
/** 添加自定义 client */
export function addClient(client: Client): void {
  const registry = readRegistry();
  
  // 重名校验
  if (registry.clients.find(c => c.name === client.name)) {
    throw new Error(`client: ${client.name} 已存在`);
  }
  
  // 校验 name 格式：kebab-case
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(client.name)) {
    throw new Error(`client 名称必须为 kebab-case 格式（小写字母、数字、连字符），不能以连字符开头或结尾`);
  }
  
  registry.clients.push(client);
  
  // 初始化 clientState
  const defaultState = getDefaultStateForClient(client);
  registry.clientState[client.name] = defaultState;
  
  writeRegistry(registry);
}

/** 删除自定义 client */
export function removeClient(name: string): void {
  const registry = readRegistry();
  const client = registry.clients.find(c => c.name === name);
  
  if (!client) {
    throw new Error(`client: ${name} 不存在`);
  }
  
  if (client.builtin) {
    throw new Error(`不能删除内置 client: ${name}`);
  }
  
  // 从 clients 列表移除
  registry.clients = registry.clients.filter(c => c.name !== name);
  
  // 清理 clientState
  delete registry.clientState[name];
  
  // IF 删除的是当前 client → 回退到 claude-code
  if (registry.currentClient === name) {
    registry.currentClient = ClientName.CLAUDE_CODE;
    // 确保 claude-code 的状态存在
    if (!registry.clientState[ClientName.CLAUDE_CODE]) {
      registry.clientState[ClientName.CLAUDE_CODE] = getDefaultStateForClient(
        registry.clients.find(c => c.name === ClientName.CLAUDE_CODE)!
      );
    }
  }
  
  writeRegistry(registry);
}

/** 切换当前 client */
export function focusClient(name: string): ClientState {
  const registry = readRegistry();
  const client = registry.clients.find(c => c.name === name);
  
  if (!client) {
    const available = registry.clients.map(c => c.name).join(", ");
    throw new Error(`client: ${name} 不存在，可用: ${available}`);
  }
  
  registry.currentClient = name;
  
  // 确保目标 client 有状态
  if (!registry.clientState[name]) {
    registry.clientState[name] = getDefaultStateForClient(client);
  }
  
  writeRegistry(registry);
  return registry.clientState[name];
}
```

**默认状态获取逻辑**：

```ts
/** 获取 client 的默认 (provider, model) */
function getDefaultStateForClient(client: Client): ClientState {
  const protocol = client.name === ClientName.DONE_CODING_AI
    ? resolveClientProtocol(client.name)
    : client.protocol;
  
  const builtinProviders = BUILTIN_PROVIDERS_BY_PROTOCOL[protocol];
  const defaultAlias = builtinProviders[0]?.alias ?? "";
  const defaultModel = builtinProviders[0]?.models[0] ?? "";
  
  return { provider: defaultAlias, model: defaultModel };
}
```

### 3. 内置数据调整（`packages/mrm/src/services/presets.ts`）

```ts
export const BUILTIN_CLIENTS: Client[] = [
  {
    name: ClientName.CLAUDE_CODE,
    protocol: Protocol.ANTHROPIC,
    configPath: `${homedir()}/.claude/settings.json`,
    builtin: true,
  },
  {
    name: ClientName.DONE_CODING_AI,
    protocol: Protocol.OPENAI,  // 仅作回退值，运行时由 resolveClientProtocol() 覆盖
    configPath: `${homedir()}/.done-coding/ai/config.json`,  // 路径更新
    builtin: true,
  },
];
```

`getClientProtocol()` 改为调用 `resolveClientProtocol()`（委托给 registry 模块），自身仅作为便捷包装。

### 4. Client 配置写入重构（`packages/mrm/src/services/client-config.ts`）

```ts
export function writeClientConfig(clientName: string, state: ClientState): void {
  const client = getAllClients().find(c => c.name === clientName);
  if (!client) throw new Error(`不支持的 client: ${clientName}`);
  
  const protocol = resolveClientProtocol(clientName);
  const provider = findProvider(protocol, state.provider);
  if (!provider) throw new Error(`服务商 "${state.provider}" 不存在`);
  
  if (client.builtin) {
    // 内置 client 有专用写入逻辑
    switch (client.name) {
      case ClientName.CLAUDE_CODE:
        writeClaudeCodeConfig(state.model, provider.baseUrl, provider.apiKey);
        break;
      case ClientName.DONE_CODING_AI:
        writeDoneCodingAiConfig(state.model, provider.baseUrl, provider.apiKey, protocol);
        break;
    }
  } else {
    // 用户自定义 client：通用写入
    writeGenericConfig(client.configPath, {
      model: state.model,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      protocol,
    });
  }
}
```

**done-coding-ai 写入逻辑**：

```ts
function writeDoneCodingAiConfig(
  model: string,
  baseUrl: string,
  apiKey: string,
  protocol: Protocol,
): void {
  const configPath = getAiConfigFilePath();
  const existing = readJsonFile<Record<string, unknown>>(configPath, {})!;
  
  const updated: Record<string, unknown> = {
    ...existing,    // 浅合并：保留已有非 mrm 字段
    model,
    baseUrl,
    apiKey,
  };
  
  // protocol 写入策略：
  // - anthropic: MUST 显式写入
  // - openai: 可省略（默认值），但为清晰起见显式写入
  updated.protocol = protocol;
  
  writeFile(configPath, updated);
}
```

**用户自定义 client 通用写入**：

```ts
function writeGenericConfig(configPath: string, data: Record<string, unknown>): void {
  // 浅合并：保留已有非 mrm 字段
  const existing = existsSync(configPath)
    ? readJsonFile<Record<string, unknown>>(configPath, {})!
    : {};
  const updated = { ...existing, ...data };
  writeFile(configPath, updated);
}
```

### 5. 新增 CLI Handlers

#### 5.1 `packages/mrm/src/handlers/client-add.ts`

```
命令：dc-mrm client add <name> <protocol> <configPath>
```

```ts
export const handler = async (argv: CliHandlerArgv<ClientAddOptions>) => {
  const { name, protocol, configPath } = argv;
  
  // 校验 protocol
  if (protocol !== Protocol.ANTHROPIC && protocol !== Protocol.OPENAI) {
    outputConsole.error(`不支持的协议: ${protocol}，合法值: anthropic | openai`);
    process.exit(1);
  }
  
  try {
    addClient({ name, protocol, configPath, builtin: false });
    outputConsole.info(`client "${name}" 添加成功`);
    outputConsole.info(`  配置文件: ${configPath}`);
    outputConsole.info(`  绑定协议: ${protocol}`);
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};
```

Options 定义（蛇形 + 驼峰双注册）：

```ts
export const getOptions = (): YargsOptionsRecord<ClientAddOptions> => ({
  name: {
    type: "string",
    describe: "client 名称（kebab-case）",
    demandOption: true,
  },
  protocol: {
    type: "string",
    choices: [Protocol.ANTHROPIC, Protocol.OPENAI],
    describe: "协议: anthropic | openai",
    demandOption: true,
  },
  configPath: {
    type: "string",
    describe: "配置文件绝对路径",
    demandOption: true,
  },
});
```

命令字符串：`"client add <name> <protocol> <configPath>"`

#### 5.2 `packages/mrm/src/handlers/client-remove.ts`

```
命令：dc-mrm client remove <name>
```

```ts
export const handler = async (argv: CliHandlerArgv<ClientRemoveOptions>) => {
  const { name } = argv;
  
  // 交互式确认
  const confirmed = await promptConfirm(`确认删除 client "${name}"？`);
  if (!confirmed) {
    outputConsole.info("已取消");
    return;
  }
  
  try {
    removeClient(name);
    outputConsole.info(`client "${name}" 已删除`);
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};
```

#### 5.3 `packages/mrm/src/handlers/client-focus.ts`

```
命令：dc-mrm client focus <name>
```

```ts
export const handler = async (argv: CliHandlerArgv<ClientFocusOptions>) => {
  const { name } = argv;
  
  try {
    const state = focusClient(name);
    outputConsole.info(
      `已切换 → 当前: ${name} → ${state.provider} → ${state.model}`,
    );
  } catch (e: any) {
    outputConsole.error(e.message);
    process.exit(1);
  }
};
```

#### 5.4 `packages/mrm/src/handlers/switch.ts` 修改

将校验逻辑从硬编码的 `Object.values(ClientName)` 改为从 `getAllClients()` 动态获取：

```ts
// 旧：
if (client !== ClientName.CLAUDE_CODE && client !== ClientName.DONE_CODING_AI) { ... }

// 新：
const allClients = getAllClients();
if (!allClients.find(c => c.name === client)) {
  const available = allClients.map(c => c.name).join(" | ");
  outputConsole.error(`不支持的 client: ${client}，可用: ${available}`);
  process.exit(1);
}
```

`switchClient` → 内部调用 `focusClient`（两者行为一致）。

命令的 help 文本不再列出（`describe: false as unknown as string` 保留），但 handler 仍工作。

#### 5.5 `packages/mrm/src/handlers/ls.ts` 修改

`--client` 的 `choices` 从 `Object.values(ClientName)` 改为动态值：

```ts
client: {
  type: "string",
  describe: "指定目标 client",
  // 移除 choices 硬编码；handler 中通过 getAllClients() 校验
}
```

Handler 中 `getClientProtocol(clientName)` 改为 `resolveClientProtocol(clientName)`。

#### 5.6 `packages/mrm/src/handlers/index.ts` 注册

```ts
// 新增 import
import { handler as clientAddHandler, commandCliInfo as clientAddCliInfo } from "./client-add";
import { handler as clientRemoveHandler, commandCliInfo as clientRemoveCliInfo } from "./client-remove";
import { handler as clientFocusHandler, commandCliInfo as clientFocusCliInfo } from "./client-focus";

// handler 分发新增
case SubcommandEnum.CLIENT_ADD:
  return clientAddHandler(argv);
case SubcommandEnum.CLIENT_REMOVE:
  return clientRemoveHandler(argv);
case SubcommandEnum.CLIENT_FOCUS:
  return clientFocusHandler(argv);

// subcommands 注册新增
clientAddCliInfo,
clientRemoveCliInfo,
clientFocusCliInfo,
```

### 6. AI 包适配（`packages/ai/src/handlers/chat.ts`）

#### 6.1 配置读写路径切换

当前 `readGlobalConfig` / `writeGlobalConfig` 读写 `~/.done-coding/config.json`：

```ts
// 旧：读写全局 config，通过 AI_CONFIG 字段存取 AI 配置
const readGlobalConfig = async () => { ... getGlobalConfigFilePath() ... };
const writeGlobalConfig = async (config: DoneCodingCliGlobalConfig) => { ... getGlobalConfigFilePath() ... };
```

改为直接使用 utils 包的 AI 配置方法：

```ts
import { readAiConfig, writeAiConfig, getAiConfigFilePath, type AiConfig } from "@done-coding/cli-utils";

// 移除 readGlobalConfig / writeGlobalConfig 本地定义
// 所有调用处改为：
const aiConfig = await readAiConfig();
await writeAiConfig({ model: "...", apiKey: "...", /* ... */ });
```

#### 6.2 函数级变更清单

| 函数 | 变更 |
|---|---|
| `getCurrentProtocol` | `readGlobalConfig()` → `readAiConfig()`；移除 `DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG` 中间层 |
| `ensureApiKey` | `readGlobalConfig()` → `readAiConfig()`；去除 `config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG]` |
| `handleProviderSwitch` | 不变（调 `getCurrentProtocol` 间接跟随变更） |
| `handleModelSwitch` | 不变（同上） |
| `handleProtocolSwitch` | `readGlobalConfig/writeGlobalConfig` → `readAiConfig/writeAiConfig`；去除 `DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG` 包装 |
| `firstTimeSetup` | 返回类型从 `AiConfig`（utils 包）不变，但写入路径改为 `writeAiConfig` |
| `chatHandler` | 移除 `let config = await readGlobalConfig()`；直接 `let aiConfig = await readAiConfig()` |

#### 6.3 导入清理

移除对 `DoneCodingCliGlobalConfig`、`DoneCodingCliGlobalConfigKeyEnum`、`getGlobalConfigFilePath` 的依赖。新增对 `readAiConfig`、`writeAiConfig`、`getAiConfigFilePath` 的导入。

### 7. 错误处理策略

| 场景 | 处理方式 |
|---|---|
| `~/.done-coding/ai/config.json` 不存在 | `readAiConfig()` 返回 `{}`，协议默认 `"openai"` |
| `~/.done-coding/ai/config.json` 存在但 `protocol` 缺失 | 按 `"openai"` 处理 |
| `~/.done-coding/ai/config.json` protocol 为非法值 | 静默回退 `"openai"` |
| `~/.done-coding/mrm/` 目录不存在 | `readRegistry()` 创建完整目录结构 + 写入默认数据 |
| `~/.done-coding/mrm/providers/` 缺少某协议文件 | `loadAllProviders()` 补齐内置 provider |
| `clients.json` 存在但 `registry.json` 缺少某 client 状态 | `readRegistry()` 自动补齐默认状态 |
| 旧 `config.json` 含 `AI_CONFIG` 字段 | 静默忽略该字段；若 `ai/config.json` 不存在则输出告警 warning |
| `client add` 的 configPath 指向不存在目录 | 接受注册；首次 `writeClientConfig` 时 `ensureDir` 自动创建 |
| `client add` 重复 name | 报错并退出 |
| `client remove` 删除内置 client | 报错并退出 |
| `client remove` 删除当前 client | 自动回退到 `claude-code` |
| `client focus` 不存在 client | 报错并列出全部可用 client |
| 并发写入 mrm 文件 | 不保证原子性，最后写者胜出（声明性约束，不实现锁） |

### 8. 迁移策略

**不做自动迁移。** 理由：配置文件是用户本地的，AI 不应擅自修改用户文件。

唯一自动行为：当 `~/.done-coding/config.json` 含 `AI_CONFIG` 字段但 `~/.done-coding/ai/config.json` 尚不存在时，输出 warning 引导用户手动迁移（仅一次）。

旧文件 `~/.done-coding/mrm/sources.json` 不被读取。用户可手动删除。

### 9. mrm 包导出更新（`packages/mrm/src/index.ts`）

```ts
export {
  // ... existing exports ...
  getAllClients,
  resolveClientProtocol,  // NEW
  addClient,              // NEW
  removeClient,           // NEW
  focusClient,            // NEW
} from "@/services/registry";
```

## 开发范式 / 参考模块

- CLI handler 模式参考现有 `packages/mrm/src/handlers/switch.ts`：标准 `CliHandlerArgv<T>` + `SubCliInfo` + `commandCliInfo` 导出
- Options 注册参考 `packages/mrm/src/handlers/ls.ts` 的 `getOptions()` 模式
- `yargs` 命令格式参考 `packages/mrm/src/handlers/model-use.ts` 的 `<model>` 位置参数
- 文件读写参考 `packages/mrm/src/services/registry.ts` 现有的 `readJsonFile` / `writeFileSync` 同步范式
- 交互式确认参考 `packages/mrm/src/utils/prompts.ts` 的 `promptConfirm`
- 路径工具参考 `packages/utils/src/cli-config.ts` 的 `path.resolve(homedir(), RELATIVE_PATH)` 模式

## 注意事项 / 已知风险

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| 1 | `readRegistry()` 从单文件 → 多文件读写，启动时增加数次 fs 调用 | 性能影响微小（每个命令周期仅初始化一次 + 3-5 个文件读取） | 懒加载 + 保持同步 API |
| 2 | 使用 `dc-mrm` 和 `dc-ai` 同一时间操作可能产生不一致（如 ai 包 `/protocol` 切换与 mrm 包 `model use` 交叉） | 低概率 | 不需要锁——各命令自身读写具备最终一致性 |
| 3 | utils 包中 `readAiConfig` 是 async 但 mrm registry 是同步的 | mrm 中无法复用 async 版本 | 在 registry 中直接 `readFileSync` + `JSON.parse` 读取 AI config；utils 包的 `readAiConfig` 供 AI 包（async handler）使用 |
| 4 | 自定义 client 的 configPath 任意指向，mrm 以 JSON 浅合并写入，可能覆盖用户手动编辑的非标准字段 | 用户接受风险（configPath 是用户自己指定的） | 浅合并策略保留未知字段；文档说明 |
| 5 | `client add` 的 name 校验正则 `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/` 需要拒绝空字符串和纯数字开头 | 边界输入 | 正则已在 `addClient` 中应用，不符合时明确报错 |

## 功能清单对比

| 旧行为 | 新行为 | 状态 |
|---|---|---|
| `~/.done-coding/config.json` 包含 AI_CONFIG | `~/.done-coding/config.json` 仅全局配置；AI 配置独立至 `ai/config.json` | ✅ 对等 |
| `~/.done-coding/mrm/sources.json` 单文件 | `~/.done-coding/mrm/` 目录结构（clients.json + registry.json + providers/） | ✅ 对等 |
| done-coding-ai 协议硬编码 OPENAI | 从 `ai/config.json` 动态读取 | ✅ 对等 |
| `dc-mrm switch` 仅限 2 个内置 client | `dc-mrm client focus` 涵盖内置 + 自定义；`switch` 保留为别名 | ✅ 对等 |
| 无 client 增删能力 | `dc-mrm client add/remove` | ✅ 新增 |
| mrm 不区分 client 来源 | Client 接口新增 `builtin` 字段区分内置/自定义 | ✅ 增强 |
| 仅 2 个内置 client | 支持动态注册 client，重启后持久化 | ✅ 新增 |
