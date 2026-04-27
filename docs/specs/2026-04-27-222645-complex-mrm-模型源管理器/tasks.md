# 实施文档：模型源管理器（mrm）

> 状态：进行中
> 任务等级：Complex
> 日期：2026-04-27

## 当前进度

- 当前任务：TASK-1
- 下一步：搭建类型定义和数据层

## 任务列表

### TASK-1: 类型定义 + 数据层 [优先级: P0]

**Files:**
- Modify: `packages/mrm/src/types/index.ts`
- Create: `packages/mrm/src/services/presets.ts`
- Create: `packages/mrm/src/services/registry.ts`

- [ ] **Step 1: 定义所有类型和枚举**

  用以下内容替换 `packages/mrm/src/types/index.ts`：

  ```typescript
  /** API 协议方案 */
  export enum Protocol {
    ANTHROPIC = 'anthropic',
    OPENAI = 'openai',
  }

  /** 客户端名称 */
  export enum ClientName {
    CLAUDE_CODE = 'claude-code',
    DONE_CODING_AI = 'done-coding-ai',
  }

  /** 子命令枚举 */
  export enum SubcommandEnum {
    LS = 'ls',
    ADD = 'add',
    USE = 'use',
    REMOVE = 'remove',
    SWITCH = 'switch',
  }

  /** 客户端 */
  export interface Client {
    name: ClientName;
    protocol: Protocol;
    /** 配置文件绝对路径，运行时 homedir 解析 */
    configPath: string;
  }

  /** 源 — 用户管理 */
  export interface Source {
    /** 源别名，唯一 */
    alias: string;
    /** API 端点 */
    baseUrl: string;
    /** 认证密钥 */
    apiKey: string;
    /** 该源支持的模型名列表 */
    models: string[];
  }

  /** 模型信息 */
  export interface ModelInfo {
    /** 模型标识名 */
    name: string;
    /** 显示名 */
    label: string;
  }

  /** 模型提供商预设 */
  export interface ProviderPreset {
    /** 提供商标识 */
    name: string;
    /** 所属协议 */
    protocol: Protocol;
    /** 旗下模型 */
    models: ModelInfo[];
    /** 默认 API 端点路径后缀（如 DeepSeek anthropic 协议需 /anthropic） */
    baseUrlSuffix?: string;
  }

  /** 注册表文件结构 */
  export interface SourcesRegistry {
    /** 当前 client 名 */
    currentClient: string;
    /** 各 client 下的源列表 */
    sources: Record<string, Source[]>;
  }

  /** ===== Client 配置文件类型 ===== */

  /** Claude Code 配置文件结构（仅列 mrm 关注的字段） */
  export interface ClaudeCodeSettings {
    /** 当前使用的模型 */
    model?: string;
    /** 环境变量 */
    env?: ClaudeCodeEnv;
    /** 自定义 API Key 生成脚本 */
    apiKeyHelper?: string;
    /** 模型 ID 映射 */
    modelOverrides?: Record<string, string>;
  }

  export interface ClaudeCodeEnv {
    /** API Key */
    ANTHROPIC_API_KEY?: string;
    /** 自定义 API 端点 */
    ANTHROPIC_BASE_URL?: string;
    /** 指定使用的模型（第三方源必需） */
    ANTHROPIC_MODEL?: string;
    /** 默认 Opus 模型映射 */
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
    /** 默认 Sonnet 模型映射 */
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
    /** 默认 Haiku 模型映射 */
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
    /** Subagent 模型 */
    CLAUDE_CODE_SUBAGENT_MODEL?: string;
    /** API 超时（毫秒） */
    API_TIMEOUT_MS?: string;
    /** 努力级别 */
    CLAUDE_CODE_EFFORT_LEVEL?: string;
    /** 允许其他 env 字段 */
    [key: string]: string | undefined;
  }

  /** done-coding-ai 全局配置文件结构 */
  export interface DoneCodingAiGlobalConfig {
    AI_CONFIG?: {
      model: string;
      apiKey: string;
      baseUrl: string;
    };
    [key: string]: unknown;
  }

  /** ===== Options 接口 ===== */

  export interface LsOptions {
    provider?: boolean;
    client?: string;
  }

  export interface AddOptions {
    alias: string;
    url: string;
    client?: string;
  }

  export interface UseOptions {
    model: string;
    client?: string;
  }

  export interface RemoveOptions {
    alias: string;
    client?: string;
  }

  export interface SwitchOptions {
    client: string;
  }
  ```

  测试：`pnpm exec tsc --noEmit` 无类型错误

- [ ] **Step 2: 创建内置预设文件**

  创建 `packages/mrm/src/services/presets.ts`：

  ```typescript
  import { Protocol, ClientName, type Client, type ProviderPreset } from '@/types';

  /** 内置 Client */
  export const BUILTIN_CLIENTS: Client[] = [
    {
      name: ClientName.CLAUDE_CODE,
      protocol: Protocol.ANTHROPIC,
      configPath: '', // 运行时解析
    },
    {
      name: ClientName.DONE_CODING_AI,
      protocol: Protocol.OPENAI,
      configPath: '', // 运行时解析
    },
  ];

  /** 内置 Provider，按协议分组 */
  export const BUILTIN_PROVIDERS_BY_PROTOCOL: Record<Protocol, ProviderPreset[]> = {
    [Protocol.ANTHROPIC]: [
      {
        name: 'anthropic',
        protocol: Protocol.ANTHROPIC,
        models: [
          { name: 'haiku', label: 'Claude Haiku' },
          { name: 'sonnet', label: 'Claude Sonnet' },
          { name: 'opus', label: 'Claude Opus' },
        ],
      },
      {
        name: 'deepseek',
        protocol: Protocol.ANTHROPIC,
        models: [
          { name: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
        ],
        baseUrlSuffix: '/anthropic',
      },
    ],

    [Protocol.OPENAI]: [
      {
        name: 'deepseek',
        protocol: Protocol.OPENAI,
        models: [
          { name: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
          { name: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
          { name: 'deepseek-chat', label: 'DeepSeek Chat' },
          { name: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
        ],
      },
      {
        name: 'qwen',
        protocol: Protocol.OPENAI,
        models: [
          { name: 'qwen-turbo', label: 'Qwen Turbo' },
          { name: 'qwen-plus', label: 'Qwen Plus' },
          { name: 'qwen-max', label: 'Qwen Max' },
        ],
      },
      {
        name: 'kimi',
        protocol: Protocol.OPENAI,
        models: [
          { name: 'moonshot-v1-8k', label: 'Moonshot V1 8K' },
          { name: 'moonshot-v1-32k', label: 'Moonshot V1 32K' },
          { name: 'moonshot-v1-128k', label: 'Moonshot V1 128K' },
        ],
      },
      {
        name: 'groq',
        protocol: Protocol.OPENAI,
        models: [
          { name: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
          { name: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
        ],
      },
    ],
  };

  /** Client 配置文件路径映射 */
  export function getClientConfigPath(clientName: ClientName): string {
    const homedir = require('os').homedir;
    switch (clientName) {
      case ClientName.CLAUDE_CODE:
        return `${homedir()}/.claude/settings.json`;
      case ClientName.DONE_CODING_AI:
        return `${homedir()}/.done-coding/config.json`;
    }
  }
  ```

- [ ] **Step 3: 创建注册表服务**

  创建 `packages/mrm/src/services/registry.ts`：

  ```typescript
  import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
  import { dirname } from 'node:path';
  import { homedir } from 'node:os';
  import type { SourcesRegistry, Source } from '@/types';
  import { BUILTIN_CLIENTS } from './presets';

  const REGISTRY_DIR = `${homedir()}/.done-coding/mrm`;
  const REGISTRY_PATH = `${REGISTRY_DIR}/sources.json`;

  function getDefaultRegistry(): SourcesRegistry {
    return {
      currentClient: 'claude-code',
      sources: initBuiltinSources(),
    };
  }

  function initBuiltinSources(): Record<string, Source[]> {
    const sources: Record<string, Source[]> = {};
    for (const client of BUILTIN_CLIENTS) {
      sources[client.name] = [];
    }
    return sources;
  }

  /** 读取注册表，不存在时自动初始化 */
  export function readRegistry(): SourcesRegistry {
    try {
      if (!existsSync(REGISTRY_PATH)) {
        const defaultReg = getDefaultRegistry();
        writeRegistry(defaultReg);
        return defaultReg;
      }
      const data = readFileSync(REGISTRY_PATH, 'utf-8');
      return JSON.parse(data) as SourcesRegistry;
    } catch {
      return getDefaultRegistry();
    }
  }

  /** 写入注册表 */
  export function writeRegistry(registry: SourcesRegistry): void {
    if (!existsSync(REGISTRY_DIR)) {
      mkdirSync(REGISTRY_DIR, { recursive: true });
    }
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  }

  /** 获取当前 client 下的源列表 */
  export function getSources(clientName: string): Source[] {
    const registry = readRegistry();
    return registry.sources[clientName] ?? [];
  }

  /** 按模型名查找支持该模型的源 */
  export function findSourcesByModel(clientName: string, model: string): Source[] {
    const sources = getSources(clientName);
    return sources.filter((s) => s.models.includes(model));
  }

  /** 添加源 */
  export function addSource(clientName: string, source: Source): void {
    const registry = readRegistry();
    if (!registry.sources[clientName]) {
      registry.sources[clientName] = [];
    }
    const existing = registry.sources[clientName].findIndex(
      (s) => s.alias === source.alias,
    );
    if (existing >= 0) {
      throw new Error(`源 "${source.alias}" 已存在`);
    }
    registry.sources[clientName].push(source);
    writeRegistry(registry);
  }

  /** 删除源 */
  export function removeSource(clientName: string, alias: string): void {
    const registry = readRegistry();
    if (!registry.sources[clientName]) {
      throw new Error(`源 "${alias}" 不存在`);
    }
    const idx = registry.sources[clientName].findIndex(
      (s) => s.alias === alias,
    );
    if (idx < 0) {
      throw new Error(`源 "${alias}" 不存在`);
    }
    registry.sources[clientName].splice(idx, 1);
    writeRegistry(registry);
  }

  /** 更新源的 apiKey */
  export function updateSourceApiKey(
    clientName: string,
    alias: string,
    apiKey: string,
  ): void {
    const registry = readRegistry();
    const sources = registry.sources[clientName];
    if (!sources) {
      throw new Error(`client "${clientName}" 下无源`);
    }
    const source = sources.find((s) => s.alias === alias);
    if (!source) {
      throw new Error(`源 "${alias}" 不存在`);
    }
    source.apiKey = apiKey;
    writeRegistry(registry);
  }

  /** 获取当前 client */
  export function getCurrentClient(): string {
    const registry = readRegistry();
    return registry.currentClient;
  }

  /** 切换当前 client */
  export function switchClient(clientName: string): void {
    const registry = readRegistry();
    if (!BUILTIN_CLIENTS.find((c) => c.name === clientName)) {
      throw new Error(`不支持的 client: ${clientName}`);
    }
    registry.currentClient = clientName;
    writeRegistry(registry);
  }
  ```

  测试：`pnpm exec tsc --noEmit` 无类型错误

- [ ] **Step 4: 类型检查验证**

  运行：`cd packages/mrm && pnpm exec tsc --noEmit`
  期望：无错误

---

### TASK-2: switch + ls handler [优先级: P0]

**Files:**
- Create: `packages/mrm/src/handlers/switch.ts`
- Create: `packages/mrm/src/handlers/ls.ts`

- [ ] **Step 1: 创建 switch handler**

  创建 `packages/mrm/src/handlers/switch.ts`：

  ```typescript
  import type { CliHandlerArgv, SubCliInfo } from '@done-coding/cli-utils';
  import { outputConsole } from '@done-coding/cli-utils';
  import { SubcommandEnum, ClientName, type SwitchOptions } from '@/types';
  import { switchClient } from '@/services/registry';

  export const handler = async (argv: CliHandlerArgv<SwitchOptions>) => {
    const { client } = argv;
    try {
      switchClient(client);
      outputConsole.log(`已切换到 client: ${client}`);
    } catch (e: any) {
      outputConsole.error(e.message);
      process.exit(1);
    }
  };

  export const commandCliInfo: SubCliInfo = {
    command: `${SubcommandEnum.SWITCH} <client>`,
    describe: `切换当前客户端 (${Object.values(ClientName).join(' | ')})`,
    handler: handler as SubCliInfo['handler'],
  };
  ```

- [ ] **Step 2: 创建 ls handler**

  创建 `packages/mrm/src/handlers/ls.ts`：

  ```typescript
  import type { CliHandlerArgv, SubCliInfo, YargsOptionsRecord } from '@done-coding/cli-utils';
  import { outputConsole } from '@done-coding/cli-utils';
  import { SubcommandEnum, Protocol, type LsOptions, type ProviderPreset } from '@/types';
  import { getCurrentClient, getSources } from '@/services/registry';
  import { BUILTIN_CLIENTS, BUILTIN_PROVIDERS_BY_PROTOCOL } from '@/services/presets';

  export const getOptions = (): YargsOptionsRecord<LsOptions> => ({
    provider: {
      type: 'boolean',
      alias: 'p',
      describe: '按模型提供商分组显示',
      default: false,
    },
    client: {
      type: 'string',
      alias: 'c',
      describe: '指定客户端',
    },
  });

  export const handler = async (argv: CliHandlerArgv<LsOptions>) => {
    const clientName = argv.client ?? getCurrentClient();
    const client = BUILTIN_CLIENTS.find((c) => c.name === clientName);
    if (!client) {
      outputConsole.error(`不支持的 client: ${clientName}`);
      process.exit(1);
    }

    const sources = getSources(clientName);
    const providers = BUILTIN_PROVIDERS_BY_PROTOCOL[client.protocol];

    if (sources.length === 0) {
      outputConsole.log(`client "${clientName}" 下暂无源，请使用 mrm add 添加`);
      return;
    }

    if (argv.provider) {
      showByProvider(sources, providers);
    } else {
      showByModel(sources, providers);
    }
  };

  /** 按 模型 → 提供商 → 源 展示 */
  function showByModel(sources: any[], providers: ProviderPreset[]) {
    /** 收集所有模型 */
    const modelMap = new Map<string, { provider: string; sourceAliases: string[] }>();
    for (const source of sources) {
      for (const model of source.models) {
        if (!modelMap.has(model)) {
          modelMap.set(model, { provider: '', sourceAliases: [] });
        }
        const entry = modelMap.get(model)!;
        entry.sourceAliases.push(source.alias);
      }
    }
    /** 从 providers 补充提供商信息 */
    for (const provider of providers) {
      for (const m of provider.models) {
        const entry = modelMap.get(m.name);
        if (entry) {
          entry.provider = provider.name;
        }
      }
    }

    outputConsole.log(`\nclient: ${(sources as any).client || ''}`);
    for (const [model, info] of modelMap) {
      outputConsole.log(`  ${model} (${info.provider || 'unknown'})`);
      outputConsole.log(`    sources: ${info.sourceAliases.join(', ')}`);
    }
    outputConsole.log('');
  }

  /** 按 提供商 → 模型 → 源 展示 */
  function showByProvider(sources: any[], providers: ProviderPreset[]) {
    const sourceByModel = new Map<string, string[]>();
    for (const source of sources) {
      for (const model of source.models) {
        if (!sourceByModel.has(model)) {
          sourceByModel.set(model, []);
        }
        sourceByModel.get(model)!.push(source.alias);
      }
    }

    outputConsole.log('');
    for (const provider of providers) {
      outputConsole.log(`${provider.name} (${provider.protocol}):`);
      for (const model of provider.models) {
        const srcs = sourceByModel.get(model.name) ?? [];
        if (srcs.length > 0) {
          outputConsole.log(`  ${model.name} → sources: ${srcs.join(', ')}`);
        }
      }
    }
    outputConsole.log('');
  }

  export const commandCliInfo: SubCliInfo = {
    command: SubcommandEnum.LS,
    describe: '列出可用模型及支持的源',
    options: getOptions(),
    handler: handler as SubCliInfo['handler'],
  };
  ```

- [ ] **Step 3: 类型检查验证**

  运行：`cd packages/mrm && pnpm exec tsc --noEmit`
  期望：无错误

---

### TASK-3: add handler [优先级: P0]

**Files:**
- Create: `packages/mrm/src/utils/prompts.ts`
- Create: `packages/mrm/src/handlers/add.ts`

- [ ] **Step 1: 创建 prompts 工具**

  创建 `packages/mrm/src/utils/prompts.ts`：

  ```typescript
  import { xPrompts } from '@done-coding/cli-utils';
  import type { Protocol, ProviderPreset, ModelInfo } from '@/types';

  /** 交互式输入 apiKey（不回显） */
  export async function promptApiKey(): Promise<string> {
    const { apiKey } = (await xPrompts([
      {
        type: 'password',
        name: 'apiKey',
        message: '请输入 API Key:',
        validate: (value: string) =>
          value.trim() ? true : 'API Key 不能为空',
      },
    ])) as { apiKey: string };
    return apiKey;
  }

  /** 交互式选择模型列表（多选） */
  export async function promptModels(protocol: Protocol): Promise<string[]> {
    const BUILTIN_PROVIDERS_BY_PROTOCOL = (
      await import('@/services/presets')
    ).BUILTIN_PROVIDERS_BY_PROTOCOL;
    const providers = BUILTIN_PROVIDERS_BY_PROTOCOL[protocol];

    const choices: { title: string; value: string }[] = [];
    for (const provider of providers) {
      for (const model of provider.models) {
        choices.push({
          title: `${model.label} (${model.name}) - ${provider.name}`,
          value: model.name,
        });
      }
    }

    const { models } = (await xPrompts([
      {
        type: 'autocompleteMultiselect',
        name: 'models',
        message: '选择该源支持的模型（空格选中，回车确认）:',
        choices,
        min: 1,
      },
    ])) as { models: string[] };
    return models;
  }

  /** 确认删除 */
  export async function promptConfirm(message: string): Promise<boolean> {
    const { confirm } = (await xPrompts([
      {
        type: 'confirm',
        name: 'confirm',
        message,
        initial: false,
      },
    ])) as { confirm: boolean };
    return confirm;
  }

  /** 选择一个选项 */
  export async function promptSelect<T extends string>(
    message: string,
    choices: { title: string; value: T }[],
  ): Promise<T> {
    const { selected } = (await xPrompts([
      {
        type: 'select',
        name: 'selected',
        message,
        choices,
      },
    ])) as { selected: T };
    return selected;
  }
  ```

- [ ] **Step 2: 创建 add handler**

  创建 `packages/mrm/src/handlers/add.ts`：

  ```typescript
  import type { CliHandlerArgv, SubCliInfo, YargsOptionsRecord } from '@done-coding/cli-utils';
  import { outputConsole } from '@done-coding/cli-utils';
  import { SubcommandEnum, type AddOptions } from '@/types';
  import { getCurrentClient, addSource } from '@/services/registry';
  import { BUILTIN_CLIENTS } from '@/services/presets';
  import { promptApiKey, promptModels } from '@/utils/prompts';

  export const getOptions = (): YargsOptionsRecord<AddOptions> => ({
    alias: {
      type: 'string',
      describe: '源别名',
      demandOption: true,
    },
    url: {
      type: 'string',
      describe: 'API 端点地址',
      demandOption: true,
    },
    client: {
      type: 'string',
      alias: 'c',
      describe: '指定客户端',
    },
  });

  export const handler = async (argv: CliHandlerArgv<AddOptions>) => {
    const { alias, url } = argv;
    const clientName = argv.client ?? getCurrentClient();
    const client = BUILTIN_CLIENTS.find((c) => c.name === clientName);
    if (!client) {
      outputConsole.error(`不支持的 client: ${clientName}`);
      process.exit(1);
    }

    outputConsole.log(`正在为 ${clientName} (${client.protocol}) 添加源...`);

    const apiKey = await promptApiKey();
    const models = await promptModels(client.protocol);

    try {
      addSource(clientName, {
        alias,
        baseUrl: url,
        apiKey,
        models,
      });
      outputConsole.log(`源 "${alias}" 添加成功`);
    } catch (e: any) {
      outputConsole.error(e.message);
      process.exit(1);
    }
  };

  export const commandCliInfo: SubCliInfo = {
    command: `${SubcommandEnum.ADD} <alias> <url>`,
    describe: '添加模型源',
    options: getOptions(),
    handler: handler as SubCliInfo['handler'],
  };
  ```

- [ ] **Step 3: 类型检查验证**

  运行：`cd packages/mrm && pnpm exec tsc --noEmit`
  期望：无错误

---

### TASK-4: use handler + client-config 写入 [优先级: P0]

**Files:**
- Create: `packages/mrm/src/services/client-config.ts`
- Create: `packages/mrm/src/handlers/use.ts`

- [ ] **Step 1: 创建 client-config 服务**

  创建 `packages/mrm/src/services/client-config.ts`：

  ```typescript
  import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
  import { dirname } from 'node:path';
  import { homedir } from 'node:os';
  import type { ClaudeCodeSettings, DoneCodingAiGlobalConfig, Source } from '@/types';
  import { ClientName } from '@/types';

  /** 写入 claude-code 配置：merge 策略，按源类型设置不同 env */
  export function writeClaudeCodeConfig(model: string, source: Source): void {
    const configPath = `${homedir()}/.claude/settings.json`;
    const existing = readJsonFile<ClaudeCodeSettings>(configPath);

    /** 基础 env：所有源都需要 */
    const env: Record<string, string> = {
      ...(existing.env ?? {}),
      ANTHROPIC_BASE_URL: source.baseUrl,
      ANTHROPIC_API_KEY: source.apiKey,
    };

    if (source.alias === 'deepseek') {
      /** DeepSeek 需要额外的模型指向配置 */
      env.ANTHROPIC_MODEL = model;
      env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
      env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
      env.CLAUDE_CODE_SUBAGENT_MODEL = model;
      env.API_TIMEOUT_MS = '3000000';
      env.CLAUDE_CODE_EFFORT_LEVEL = 'max';
    }
    /** n1n 等中转源仅需 baseUrl + apiKey，已在基础 env 中 */

    const updated: ClaudeCodeSettings = {
      ...existing,
      model,
      env,
    };
    writeConfigFile(configPath, updated);
  }

  /** 写入 done-coding-ai 配置：merge 策略 */
  export function writeDoneCodingAiConfig(model: string, source: Source): void {
    const configPath = `${homedir()}/.done-coding/config.json`;
    const existing = readJsonFile<DoneCodingAiGlobalConfig>(configPath);
    const updated: DoneCodingAiGlobalConfig = {
      ...existing,
      AI_CONFIG: {
        model,
        baseUrl: source.baseUrl,
        apiKey: source.apiKey,
      },
    };
    writeConfigFile(configPath, updated);
  }

  function readJsonFile<T>(path: string): T {
    if (!existsSync(path)) {
      return {} as T;
    }
    try {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return {} as T;
    }
  }

  function writeConfigFile(path: string, data: any): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  }
  ```

- [ ] **Step 2: 创建 use handler**

  创建 `packages/mrm/src/handlers/use.ts`：

  ```typescript
  import type { CliHandlerArgv, SubCliInfo } from '@done-coding/cli-utils';
  import { outputConsole } from '@done-coding/cli-utils';
  import { SubcommandEnum, ClientName, type UseOptions } from '@/types';
  import { getCurrentClient, findSourcesByModel, updateSourceApiKey } from '@/services/registry';
  import { BUILTIN_CLIENTS } from '@/services/presets';
  import { writeClaudeCodeConfig, writeDoneCodingAiConfig } from '@/services/client-config';
  import { promptApiKey, promptSelect } from '@/utils/prompts';

  export const handler = async (argv: CliHandlerArgv<UseOptions>) => {
    const { model } = argv;
    const clientName = argv.client ?? getCurrentClient();
    const client = BUILTIN_CLIENTS.find((c) => c.name === clientName);
    if (!client) {
      outputConsole.error(`不支持的 client: ${clientName}`);
      process.exit(1);
    }

    const sources = findSourcesByModel(clientName, model);

    if (sources.length === 0) {
      outputConsole.error(
        `client "${clientName}" 下没有支持模型 "${model}" 的源，请先用 mrm add 添加`,
      );
      process.exit(1);
    }

    /** 选择源 */
    let selected: (typeof sources)[0];
    if (sources.length === 1) {
      selected = sources[0];
      outputConsole.log(`使用源: ${selected.alias}`);
    } else {
      const choice = await promptSelect(
        `模型 "${model}" 有多个可用源，请选择:`,
        sources.map((s) => ({
          title: `${s.alias} (${s.baseUrl})`,
          value: s.alias,
        })),
      );
      selected = sources.find((s) => s.alias === choice)!;
    }

    /** 检查 apiKey */
    if (!selected.apiKey) {
      outputConsole.log(`源 "${selected.alias}" 未设置 apiKey`);
      const apiKey = await promptApiKey();
      selected.apiKey = apiKey;
      updateSourceApiKey(clientName, selected.alias, apiKey);
    }

    /** 写入 client 配置 */
    try {
      switch (client.name) {
        case ClientName.CLAUDE_CODE:
          writeClaudeCodeConfig(model, selected);
          break;
        case ClientName.DONE_CODING_AI:
          writeDoneCodingAiConfig(model, selected);
          break;
      }
      outputConsole.log(
        `已切换: model=${model}, source=${selected.alias}, client=${client.name}`,
      );
    } catch (e: any) {
      outputConsole.error(`写入配置失败: ${e.message}`);
      process.exit(1);
    }
  };

  export const commandCliInfo: SubCliInfo = {
    command: `${SubcommandEnum.USE} <model>`,
    describe: '选择模型及源',
    handler: handler as SubCliInfo['handler'],
  };
  ```

- [ ] **Step 3: 类型检查验证**

  运行：`cd packages/mrm && pnpm exec tsc --noEmit`
  期望：无错误

---

### TASK-5: remove handler [优先级: P1]

**Files:**
- Create: `packages/mrm/src/handlers/remove.ts`

- [ ] **Step 1: 创建 remove handler**

  创建 `packages/mrm/src/handlers/remove.ts`：

  ```typescript
  import type { CliHandlerArgv, SubCliInfo } from '@done-coding/cli-utils';
  import { outputConsole } from '@done-coding/cli-utils';
  import { SubcommandEnum, type RemoveOptions } from '@/types';
  import { getCurrentClient, removeSource } from '@/services/registry';
  import { promptConfirm } from '@/utils/prompts';

  export const handler = async (argv: CliHandlerArgv<RemoveOptions>) => {
    const { alias } = argv;
    const clientName = argv.client ?? getCurrentClient();

    const confirmed = await promptConfirm(
      `确认从 client "${clientName}" 删除源 "${alias}"？`,
    );

    if (!confirmed) {
      outputConsole.log('已取消');
      return;
    }

    try {
      removeSource(clientName, alias);
      outputConsole.log(`源 "${alias}" 已删除`);
    } catch (e: any) {
      outputConsole.error(e.message);
      process.exit(1);
    }
  };

  export const commandCliInfo: SubCliInfo = {
    command: `${SubcommandEnum.REMOVE} <alias>`,
    describe: '删除模型源',
    handler: handler as SubCliInfo['handler'],
  };
  ```

- [ ] **Step 2: 类型检查验证**

  运行：`cd packages/mrm && pnpm exec tsc --noEmit`
  期望：无错误

---

### TASK-6: 整合 handlers/index.ts + 清理 test [优先级: P1]

**Files:**
- Modify: `packages/mrm/src/handlers/index.ts`
- Delete: `packages/mrm/src/handlers/test.ts`
- Modify: `packages/mrm/src/types/index.ts`（更新 SubcommandEnum，移除 TEST）

- [ ] **Step 1: 更新 SubcommandEnum（移除 TEST）**

  确认 `packages/mrm/src/types/index.ts` 中 `SubcommandEnum` 已不含 `TEST`（TASK-1 已定义正确版本）。

- [ ] **Step 2: 更新 handlers/index.ts**

  用以下内容替换 `packages/mrm/src/handlers/index.ts`：

  ```typescript
  import {
    handler as lsHandler,
    commandCliInfo as lsCommandCliInfo,
  } from './ls';
  import {
    handler as addHandler,
    commandCliInfo as addCommandCliInfo,
  } from './add';
  import {
    handler as useHandler,
    commandCliInfo as useCommandCliInfo,
  } from './use';
  import {
    handler as removeHandler,
    commandCliInfo as removeCommandCliInfo,
  } from './remove';
  import {
    handler as switchHandler,
    commandCliInfo as switchCommandCliInfo,
  } from './switch';
  import injectInfo from '@/injectInfo.json';
  import { SubcommandEnum } from '@/types';
  import {
    createSubcommand,
    getRootScriptName,
    type CliHandlerArgv,
    type CliInfo,
  } from '@done-coding/cli-utils';

  export { lsHandler, addHandler, useHandler, removeHandler, switchHandler };

  /** 导出供外部编程使用 */
  export const handler = async (
    command: SubcommandEnum,
    argv: CliHandlerArgv<any>,
  ) => {
    switch (command) {
      case SubcommandEnum.LS:
        return lsHandler(argv);
      case SubcommandEnum.ADD:
        return addHandler(argv);
      case SubcommandEnum.USE:
        return useHandler(argv);
      case SubcommandEnum.REMOVE:
        return removeHandler(argv);
      case SubcommandEnum.SWITCH:
        return switchHandler(argv);
      default:
        throw new Error(`不支持的命令 ${command}`);
    }
  };

  const { version, description: describe } = injectInfo;

  export const commandCliInfo: Omit<CliInfo, 'usage'> = {
    describe,
    version,
    subcommands: [
      switchCommandCliInfo,
      lsCommandCliInfo,
      addCommandCliInfo,
      useCommandCliInfo,
      removeCommandCliInfo,
    ].map(createSubcommand),
    demandCommandCount: 1,
    rootScriptName: getRootScriptName({ packageJson: injectInfo }),
  };
  ```

- [ ] **Step 3: 删除 test handler**

  删除文件 `packages/mrm/src/handlers/test.ts`

- [ ] **Step 4: 类型检查 + 构建验证**

  运行：`cd packages/mrm && pnpm exec tsc --noEmit && pnpm build`
  期望：无错误，构建成功

---

### TASK-7: 运行测试 [优先级: P0]

- [ ] **Step 1: Test-First — 先运行现有测试**

  运行：`cd packages/mrm && pnpm vitest run`
  记录退出码和输出

- [ ] **Step 2: 运行构建产物验证**

  运行：`dc-mrm --help`
  期望：显示所有子命令（switch/ls/add/use/remove）

  运行：`dc-mrm switch --help`
  期望：显示用法和选项

- [ ] **Step 3: Lint 检查**

  运行：`cd packages/mrm && pnpm eslint --fix src/`
  期望：无错误
