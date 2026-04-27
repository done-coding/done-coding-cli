# 技术设计文档：模型源管理器（mrm）

> 状态：待审核
> 任务等级：Complex
> 日期：2026-04-27

## 变更范围

- **Direct Targets**：`packages/mrm/src/` 下所有文件
- **Collateral Reads**：`packages/utils/src/`（参考 cli-utils API）、`packages/git/src/`（参考已有 CLI 包模式）
- **Out-of-Scope**：`packages/ai/`（后续消费 mrm 库 API，不在本次范围）

## 文件结构

```
packages/mrm/src/
├── cli.ts                     # 入口：createCommand()
├── main.ts                    # createCommand() + createAsSubcommand()
├── index.ts                   # 公共 API 导出
├── injectInfo.json            # 构建时注入元数据
├── types/
│   └── index.ts               # SubcommandEnum、选项接口、Client/Source/Protocol 类型
├── handlers/
│   ├── index.ts               # 聚合所有 handler → commandCliInfo
│   ├── switch.ts              # mrm switch <client>
│   ├── ls.ts                  # mrm ls [--provider] [--client]
│   ├── add.ts                 # mrm add <alias> <url> [--client]
│   ├── use.ts                 # mrm use <model> [--client]
│   └── remove.ts              # mrm remove <alias> [--client]
├── services/
│   ├── registry.ts            # Source 注册表 CRUD（读/写 sources.json）
│   ├── client-config.ts       # 读/写各 client 配置文件
│   └── presets.ts             # 内置 client/source 预设
└── utils/
    ├── index.ts               # 工具函数 barrel
    └── prompts.ts             # 交互式提示定义
```

## 数据模型

```typescript
// === 核心类型 ===

/** API 协议方案 */
enum Protocol {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
}

/** 客户端名称 */
enum ClientName {
  CLAUDE_CODE = 'claude-code',
  DONE_CODING_AI = 'done-coding-ai',
}

/** 客户端 */
interface Client {
  name: ClientName;
  protocol: Protocol;
  /** 绝对路径，运行时通过 homedir() 解析 */
  configPath: string;
}

/** 源 — 用户管理 */
interface Source {
  /** 源别名，唯一 */
  alias: string;
  /** API 端点 */
  baseUrl: string;
  /** 认证密钥（可空，mrm use 时若空则提示输入） */
  apiKey: string;
  /** 该源支持的模型名列表 */
  models: string[];
}

/** 模型提供商 */
interface Provider {
  /** 提供商标识 */
  name: string;
  /** 旗下模型 */
  models: ModelInfo[];
}

/** 模型信息 */
interface ModelInfo {
  /** 模型标识名 */
  name: string;
  /** 显示名 */
  label: string;
}

/** 注册表文件结构 */
interface SourcesRegistry {
  /** 当前 client 名 */
  currentClient: string;
  sources: {
    [clientName: string]: Source[];
  };
}
```

### 各 Client 配置文件类型（单独定义）

```typescript
// ===== claude-code 配置 (~/.claude/settings.json) =====

/** Claude Code 配置文件结构（仅列 mrm 关注的字段，其余 merge 保留） */
interface ClaudeCodeSettings {
  /** 当前使用的模型 */
  model?: string;
  /** 环境变量（第三方源配置主入口） */
  env?: ClaudeCodeEnv;
  /** 自定义 API Key 生成脚本 */
  apiKeyHelper?: string;
  /** 模型 ID 映射 */
  modelOverrides?: Record<string, string>;
}

interface ClaudeCodeEnv {
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
```

**不同源写入 env 字段的差异**：

| 源类型 | 写入的 env 字段 |
|--------|---------------|
| **deepseek**（Anthropic 协议） | `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` + `ANTHROPIC_DEFAULT_OPUS_MODEL` + `ANTHROPIC_DEFAULT_SONNET_MODEL` + `ANTHROPIC_DEFAULT_HAIKU_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL` + `API_TIMEOUT_MS`(3000000) + `CLAUDE_CODE_EFFORT_LEVEL`(max)<br>所有模型字段值 = 用户选择的模型名 |
| **n1n**（中转源） | `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`（auth_token） |
| **anthropic**（默认源） | `ANTHROPIC_API_KEY`（仅当非空时写入） |

writer 通过源别名识别类型，写入对应的 env 字段组合。

// ===== done-coding-ai 配置 (~/.done-coding/config.json) =====

/** done-coding-ai 全局配置文件结构 */
interface DoneCodingAiGlobalConfig {
  AI_CONFIG?: DoneCodingAiConfig;
  ASSETS_CONFIG_REPO_URL?: string;
  /** 允许其他字段 */
  [key: string]: unknown;
}

interface DoneCodingAiConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
}
```

### Client 配置写入映射

| client | config 类型 | 写入字段 |
|--------|------------|---------|
| `claude-code` | `ClaudeCodeSettings` | `model` = 选中的模型名<br>`env.ANTHROPIC_BASE_URL` = source.baseUrl<br>`env.ANTHROPIC_API_KEY` = source.apiKey<br>若为默认源（api.anthropic.com + anthropic）则 `ANTHROPIC_API_KEY` 仅在 apiKey 非空时写入 |
| `done-coding-ai` | `DoneCodingAiGlobalConfig` | `AI_CONFIG.model` = 选中的模型名<br>`AI_CONFIG.baseUrl` = source.baseUrl<br>`AI_CONFIG.apiKey` = source.apiKey |

两种 client 的 config writer 均使用 **merge 策略**（读取现有 JSON → 修改目标字段 → 写回），不覆盖文件中其他已有字段。

## 数据流

```
用户执行命令
     │
     ▼
handler 读取 ~/.done-coding/mrm/sources.json（Registry）
     │
     ├─ ls:    Registry → 按 模型→提供商→源 聚合展示
     ├─ add:   用户输入 → 写入 Registry
     ├─ use:   Registry 查源 → 选源 → 写入 Client Config File
     ├─ remove: 删除 Registry 中条目
     └─ switch: 更新 Registry.currentClient
```

### 关键路径：`mrm use <model>` 写入流程

```
mrm use sonnet
     │
     ▼
读取 sources.json
     │
     ▼
查找 client="claude-code" 下支持 "sonnet" 的源
     ├── 0 个 → 报错退出
     ├── 1 个
     │     └── apiKey 为空？→ 提示输入 → 回写 Registry
     │     └── 写入 client 配置文件
     └── 多个 → 交互式选源 → 同上
```

### Client 配置写入映射

| client | 文件 | 写入字段 |
|--------|------|---------|
| `claude-code` | `~/.claude/settings.json` | 合并写入：读取现有 JSON → 设置 apiUrl + apiKey + model → 写回 |
| `done-coding-ai` | `~/.done-coding/config.json` | 合并写入：读取现有 JSON → 设置 AI_CONFIG = { baseUrl, apiKey, model } → 写回 |

config writer 使用 **merge 策略**（读取 → 修改 → 写回），不覆盖文件中其他已有字段。

## 子命令与选项

```
dc-mrm
├── ls [--provider] [--client=<name>]
├── add <alias> <url> [--client=<name>]
├── use <model> [--client=<name>]
├── remove <alias> [--client=<name>]
└── switch <client>
```

所有命令使用 `--client` 公共选项（通过 `getConfigFileCommonOptions` 或自定义 builder）。`switch` 无 `--client` 参数。

## 架构决策记录（ADR）

### ADR-1: 注册表文件格式

**决策**：使用单个 JSON 文件 `~/.done-coding/mrm/sources.json` 存储所有 client 下的源注册表 + 当前 client 标识。

**备选**：
- 每个 client 一个文件（如 `sources-claude-code.json`）→ 管理更分散
- 独立文件存 currentClient → 多了 I/O

**权衡**：单文件更简单，sources.json 规模很小（源数量 < 10），无性能问题。

### ADR-2: apiKey 明文存储

**决策**：apiKey 明文存储在 sources.json 中。

**备选**：加密存储（AES）→ 增加复杂度，需要管理加密密钥

**权衡**：与 nrm 一致，用户自行承担安全风险。后续可升级为 keychain 集成。

### ADR-3: Client 配置合并写入

**决策**：写入 client 配置文件时采用 read → merge → write 策略。

**理由**：不破坏用户已有的其他配置字段。

### ADR-4: `remove` 不写回 client 配置

**决策**：`mrm remove` 仅从注册表删除源，不修改 client 配置文件。

**理由**：用户可能只想清理注册表；配置文件中可能有其他工具写入的值。`use` 是唯一的配置写入入口。

## 内置预设（presets.ts）

### 内置 Client

```typescript
const BUILTIN_CLIENTS: Client[] = [
  {
    name: ClientName.CLAUDE_CODE,
    protocol: Protocol.ANTHROPIC,
    configPath: '~/.claude/settings.json', // 运行时 homedir 解析
  },
  {
    name: ClientName.DONE_CODING_AI,
    protocol: Protocol.OPENAI,
    configPath: '~/.done-coding/config.json',
  },
];
```

### 内置 Source（初始注册表）

```typescript
// claude-code 下的默认源
const CLAUDE_CODE_DEFAULT_SOURCES: Source[] = [
  {
    alias: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    models: ['haiku', 'sonnet', 'opus'],
  },
  {
    alias: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    models: ['deepseek-v4-pro'],
  },
];

// done-coding-ai 下的默认源（openai 协议，支持所有 OpenAI 兼容提供商）
const DONE_CODING_CLI_DEFAULT_SOURCES: Source[] = [
  {
    alias: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
  },
  {
    alias: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    apiKey: '',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  {
    alias: 'kimi',
    baseUrl: 'https://api.moonshot.cn',
    apiKey: '',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  {
    alias: 'groq',
    baseUrl: 'https://api.groq.com/openai',
    apiKey: '',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  },
];
```

### 内置 Provider（按协议划分）

同一公司支持多种协议时，每种协议独立定义一个 Provider 条目（如 DeepSeek 同时出现在两个协议下，且不同协议下的模型集合、baseUrl 后缀不同）。

```typescript
interface ProviderPreset {
  /** 提供商标识，如 'anthropic'、'deepseek' */
  name: string;
  /** 所属协议 */
  protocol: Protocol;
  /** 旗下模型 */
  models: ModelInfo[];
  /** 默认 API 端点路径后缀（可选，用于拼接 baseUrl） */
  baseUrlSuffix?: string;
}

const BUILTIN_PROVIDERS_BY_PROTOCOL: Record<Protocol, ProviderPreset[]> = {

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
      /** DeepSeek 的 Anthropic 协议端点需拼接 /anthropic */
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
```

**说明**：DeepSeek 的 Anthropic 协议端点（如 `https://api.deepseek.com/anthropic`）与 OpenAI 协议端点（`https://api.deepseek.com`）不同，故拆为两个独立 Provider 条目，并通过 `baseUrlSuffix` 区分。

## 注意事项 / 已知风险

| 风险 | 影响 | 应对 |
|------|------|------|
| `~/.claude/settings.json` schema 变更 | 写入失败或格式错误 | 使用 merge 策略，仅设置确认需要的字段；写入前验证 JSON 合法性 |
| 用户手动编辑 sources.json 导致格式损坏 | 注册表读取失败 | 读取时捕获 JSON parse 错误，提示用户检查或重建 |
| 同一 baseUrl 注册多个名 | 源列表显示冗余 | `mrm add` 时检查 baseUrl 去重（可选，先不实现） |
| apiKey 明文泄漏风险 | 安全风险 | README 注明风险；后续可选升级 keychain |

## 实施时要移除的文件

- `src/handlers/test.ts` — 初始化示例，实施时删除
- `SubcommandEnum.TEST` — 对应类型定义
