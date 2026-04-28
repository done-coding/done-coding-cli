# 技术设计文档：模型源管理器（mrm）V2

> 状态：待审核
> 任务等级：Complex
> 日期：2026-04-28

## 变更范围

- **Direct Targets**：`packages/mrm/src/` 全部源文件（重构）
- **Collateral Reads**：`packages/utils/src/cli.ts`、`packages/utils/src/file-operate.ts`、`packages/utils/src/env-config.ts`
- **Out-of-Scope**：`packages/ai/`

## 删除 / 新增文件

| 操作 | 文件 |
|------|------|
| 删除 | src/handlers/add.ts, use.ts, remove.ts, test.ts |
| 新增 | src/handlers/provider-add.ts, provider-use.ts, provider-remove.ts |
| 新增 | src/handlers/model-add.ts, model-remove.ts, model-use.ts |
| 修改 | src/handlers/switch.ts, ls.ts, index.ts |
| 修改 | src/types/index.ts, src/services/presets.ts, registry.ts, client-config.ts |

## 数据模型

```typescript
// ===== 枚举 =====

enum Protocol {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
}

enum ClientName {
  CLAUDE_CODE = 'claude-code',
  DONE_CODING_AI = 'done-coding-ai',
}

enum SubcommandEnum {
  LS = 'ls',
  USE = 'use',                    // 快捷别名
  SWITCH = 'switch',
  PROVIDER_ADD = 'provider-add',
  PROVIDER_USE = 'provider-use',
  PROVIDER_REMOVE = 'provider-remove',
  MODEL_ADD = 'model-add',
  MODEL_REMOVE = 'model-remove',
  MODEL_USE = 'model-use',
}

// ===== 核心结构 =====

interface Client {
  name: ClientName;
  protocol: Protocol;
  configPath: string;
}

interface Provider {
  /** 服务商别名，同协议下唯一 */
  alias: string;
  /** API 端点 */
  baseUrl: string;
  /** 认证密钥 */
  apiKey: string;
  /** 支持的模型 */
  models: string[];
  /** 所属协议 */
  protocol: Protocol;
  /** 是否内置（内置不可删除） */
  builtin: boolean;
}

/** registry 中每个 provider 的模型可区分内置/用户添加 */
interface ModelEntry {
  name: string;
  builtin: boolean;
}

/** 每个 client 的状态 */
interface ClientState {
  provider: string;    // 当前 provider alias
  model: string;       // 当前 model name
}

/** 注册表 */
interface Registry {
  currentClient: string;
  clientState: Record<string, ClientState>;
  /** providers 按协议分组，多 client 共享 */
  providers: Record<Protocol, Provider[]>;
}

// ===== Client 配置类型 =====

interface ClaudeCodeSettings {
  model?: string;
  env?: ClaudeCodeEnv;
  apiKeyHelper?: string;
  modelOverrides?: Record<string, string>;
}

interface ClaudeCodeEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  CLAUDE_CODE_SUBAGENT_MODEL?: string;
  API_TIMEOUT_MS?: string;
  CLAUDE_CODE_EFFORT_LEVEL?: string;
  [key: string]: string | undefined;
}

interface DoneCodingAiGlobalConfig {
  AI_CONFIG?: { model: string; apiKey: string; baseUrl: string };
  [key: string]: unknown;
}
```

## 命令结构

```
mrm switch <client>
mrm ls [--view=model|provider]
mrm provider add <alias> <url>
mrm provider use <alias>
mrm provider remove <alias>
mrm model add <providerAlias> <modelName>
mrm model remove <providerAlias> <modelName>
mrm model use <modelName> [--provider=<alias>]
mrm use <modelName> [--provider=<alias>]           # 同 model use
```

所有命令均基于 `mrm switch` 设置的当前 client 操作，不接受 `--client` 参数。每条命令执行后会显示 `当前: <client> → <provider> → <model>` 提示。

## 核心流程

### 切换 client：`mrm switch`

```
mrm switch claude-code
  ├── 校验 ClientName 合法性
  ├── registry.clientState['claude-code'] 存在？
  │     ├── 是 → 恢复 (provider, model)
  │     └── 否 → 设为默认 (anthropic, sonnet)
  └── 更新 registry.currentClient，写 registry，提示状态行
```

### 切换 provider / model 的级联保证

```
mrm provider use <alias>
  ├── 当前 protocol 下查找 provider → 校验
  ├── 更新 clientState[currentClient].provider
  ├── 设该 provider 的默认 model（models[0]）
  ├── 写 registry
  └── 写 client 配置文件

mrm model use <name> [--provider=xxx]
  ├── [可选] 先切 provider（同 provider use）
  ├── 目标 provider 下查找 model → 校验
  ├── 更新 clientState[currentClient].model
  ├── 写 registry
  └── 写 client 配置文件
```

### 删除 provider / model 的回退

```
mrm provider remove <alias>
  ├── 内置？ → 报错退出
  ├── 确认
  ├── 当前使用？ → clientState 回退到默认 provider + 默认 model
  └── 写 registry

mrm model remove <pAlias> <mName>
  ├── provider 内置且 model 内置？ → 报错退出
  ├── 确认
  ├── 当前使用且是 provider 最后一 model？ → 回退 provider
  └── 写 registry
```

## Client 配置写入（`mrm provider use` / `mrm model use` 触发）

每个切换操作最终调用 `writeClientConfig()`，该函数：

1. 读取当前 client 的 configPath
2. merge 写入：对于 claude-code → 写入 `ClaudeCodeSettings`（含 env 的 DeepSeek 特殊处理）；对于 done-coding-ai → 写入 `AI_CONFIG`

写入策略与 V1 一致（merge 不覆盖其他字段），DeepSeek 仍需要额外的 env 模型映射。

## 内置预设

### 内置 Client

```typescript
const BUILTIN_CLIENTS: Client[] = [
  { name: ClientName.CLAUDE_CODE,  protocol: Protocol.ANTHROPIC, configPath: '' },
  { name: ClientName.DONE_CODING_AI, protocol: Protocol.OPENAI, configPath: '' },
];
```

configPath 运行时通过 `getClientConfigPath()` 解析（同 V1）。

### 内置 Provider（builtin: true）

**Anthropic 协议：**

| alias | baseUrl | 默认模型 |
|-------|---------|---------|
| anthropic | https://api.anthropic.com | haiku, sonnet, opus |
| deepseek | https://api.deepseek.com/anthropic | deepseek-v4-pro, deepseek-v4-flash, deepseek-chat, deepseek-reasoner |

**OpenAI 协议：**

| alias | baseUrl | 默认模型 |
|-------|---------|---------|
| openai | https://api.openai.com | gpt-4o, gpt-4o-mini |
| deepseek | https://api.deepseek.com | deepseek-v4-pro, deepseek-v4-flash, deepseek-chat, deepseek-reasoner |
| qwen | https://dashscope.aliyuncs.com/compatible-mode | qwen-turbo, qwen-plus, qwen-max |
| kimi | https://api.moonshot.cn | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k |

### 默认 ClientState（出厂设置，仅首次使用）

| client | provider | model |
|--------|----------|-------|
| claude-code | anthropic | sonnet |
| done-coding-ai | deepseek | deepseek-v4-pro |

## ADR

### ADR-1: Provider 按 Protocol 共享

**决策**：Provider 注册在 Protocol 维度，不按 Client 维度。Client 通过绑定的 Protocol 获取可用 Provider 列表。

**理由**：不同 Client 可能使用同一套 API 协议（如 done-coding-ai + 未来其他 openai 协议客户端），共享 Provider 避免重复注册。

**权衡**：一个 Protocol 下 provider alias 必须唯一。

### ADR-2: ClientState 持久化

**决策**：registry 中存储每个 client 的上次 (provider, model) 组合。切回时恢复，而非重置为出厂设置。

**理由**：用户体验——用户可能在不同 client 间频繁切换，不应每次回到出厂值。

### ADR-3: builtin 标记保护

**决策**：Provider 和 Model 各有 `builtin: boolean` 标记。内置项不可删除。

**理由**：出厂预设应该始终可用。用户可以基于内置 provider 添加自定义模型，也可以添加自定义 provider。

### ADR-4: 级联默认保证

**决策**：每次切换 client → provider → model 链中任一级，自动填充下游默认值，确保链不悬空。

### ADR-5: `mrm use` 双注册

**决策**：`mrm model use` 和 `mrm use` 是同一个 handler，通过 yargs 的 `command` 字段注册为两个命令。

**理由**：降低日常使用摩擦——大部分用户只想快速切模型。

## 注意事项 / 已知风险

| 风险 | 影响 | 应对 |
|------|------|------|
| V1 registry 格式不兼容 | 已有用户数据丢失 | 读取时检测旧格式，若存在则提示迁移或忽略 |
| 内置 provider 模型列表变更 | 已有 registry 中模型过期 | 首次初始化写内置数据，后续读取时检查并补充缺失项 |
| `mrm model use --provider=xxx` 原子性 | provider 切换失败但 model 已记录 | handler 内先切 provider，成功后才切 model |

## 实施时要删除的文件

- `src/handlers/add.ts`
- `src/handlers/use.ts`
- `src/handlers/remove.ts`
- `src/handlers/test.ts`
