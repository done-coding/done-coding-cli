# 技术设计文档：AI 对话流程串通

> 状态：已审核通过
> 任务等级：Complex
> 日期：2026-04-26

## 变更范围

- **Direct Targets**：`packages/ai/src/handlers/chat.ts`（新建）、`packages/ai/src/services/api-client.ts`（新建）、`packages/ai/src/services/model-presets.ts`（新建）、`packages/ai/src/types/index.ts`（扩）、`packages/ai/src/handlers/index.ts`（扩）、`packages/ai/package.json`（扩）、`packages/utils/src/cli-config.ts`（扩）、`packages/cli/src/main.ts`（改）
- **Collateral Reads**：`packages/utils/src/cli.ts`、`packages/utils/src/env-config.ts`、`packages/utils/src/file-operate.ts`、`packages/cli/src/index.ts`
- **Out-of-Scope**：`packages/ai/src/handlers/test.ts`、其他所有子包

## 架构决策

### 方案选择

采用方案 A：AI 逻辑全在 `packages/ai`，cli 只做入口路由。遵循现有分层架构。

### ADR: 使用 openai npm SDK 而非自建 fetch

| 项 | 内容 |
|---|---|
| **决策** | 引入 `openai` npm 包（^4.x）作为 AI API 客户端 |
| **背景** | 预设模型全部兼容 OpenAI 协议，SDK 提供 `.stream()` 一行流式、完整 TypeScript 类型、baseURL 可改为任意兼容端点 |
| **权衡** | 增加一个依赖 vs 自建 SSE parser。命令签名更简洁，维护成本更低 |

## 关键技术点

### 1. 全局配置类型升级

`packages/utils/src/cli-config.ts`：

```typescript
// DoneCodingCliGlobalConfig 从统一 string 改为每个 key 各自定义值类型
export type DoneCodingCliGlobalConfig = {
  [DoneCodingCliGlobalConfigKeyEnum.ASSETS_CONFIG_REPO_URL]: string;
  [DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG]: AiConfig;
};

export type AiConfig = {
  model: string;
  apiKey: string;
  baseUrl: string;
};
```

`getGlobalConfig()` 函数需适配新类型——每个 key 的默认值类型不再统一。

### 2. API 客户端

`packages/ai/src/services/api-client.ts`：

- 使用 `openai` SDK：`new OpenAI({ apiKey, baseURL })`
- 流式调用：`client.chat.completions.create({ model, messages, stream: true })`
- `for await (const chunk of stream)` 逐 token 回调 `onToken(content)`
- 网络/API 错误由调用方 catch 并友好提示

### 3. 模型预设（两级结构）

`packages/ai/src/services/model-presets.ts`：

```typescript
// 两级结构：ProviderPreset（服务商） → ModelInfo（模型）
export type ProviderPreset = {
  label: string;       // 服务商名称
  baseUrl: string;     // API 地址
  models: ModelInfo[]; // 该服务商下的模型列表
};

export const PROVIDER_PRESETS = [
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com",
    models: [
      { model: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { model: "deepseek-v4-pro",   label: "DeepSeek V4 Pro" },
      { model: "deepseek-chat",     label: "DeepSeek V3 (弃用标注)" },
      { model: "deepseek-reasoner", label: "DeepSeek R1 (弃用标注)" },
    ]
  },
  { label: "通义千问", ... },
  { label: "Kimi", ... },
  { label: "Groq", ... },
];
```

选择流程：选服务商 → 选该服务商下的模型。自定义服务商直接输入 model + baseUrl。

### 4. Chat Handler 结构

`chat.ts` 拆分为三个独立函数：

- `selectProviderAndModel()` — 选服务商 → 选模型，返回 `{ model, baseUrl }`（不含 key）
- `selectModelForProvider(provider)` — 在当前服务商下选模型
- `firstTimeSetup()` — 调用 `selectProviderAndModel()` + 输入 API Key

其中 `ChatKeywordEnum` 新增 `PROVIDER = "/provider"`：
- `/provider`：调用 `selectProviderAndModel()`，保留 API Key
- `/model`：根据当前 `baseUrl` 匹配服务商 → 直接选模型；自定义 baseUrl 则走完整流程

注册方式遵循 TECH_SNAPSHOT 子包标准模式。`SubcommandEnum` 仅保留 `CHAT`（`TEST` 已移除）。

### 5. CLI 入口路由

`packages/cli/src/main.ts` 的 `handler()` 方法：

```
无子命令 → xPrompts "是否唤起 AI 对话？"
  → y → 调用 aiHandler(SubcommandEnum.CHAT, argv)
  → n → 输出 --help
```

`createChat` 假实现删除。

## 数据流

### 首次使用

```
DC → y → getGlobalConfig() → AI_CONFIG 不存在
  → 展示 MODEL_PRESETS → 用户选模型
  → xPrompts 输入 API Key
  → writeJsonFileAsync(configPath, { ...existing, AI_CONFIG: { model, apiKey, baseUrl } })
  → 进入对话循环
```

### 已有配置

```
DC → y → getGlobalConfig() → AI_CONFIG 存在
  → 提示 "使用 {model}，输入对话内容" → 进入对话循环
```

### 对话循环

```
loop:
  xPrompts({ type: "text" }) → 用户输入
  → 空输入 → continue
  → /exit → return
  → /provider → selectProviderAndModel() → update config → continue
  → /model → 当前服务商匹配 → selectModelForProvider() → update config
            → 匹配不到 → selectProviderAndModel() → update config → continue
  → /clear → 清屏 → continue
  → 其他 → streamChat(config, input) → 逐 token 输出 → 换行 → continue
         → 401/AuthenticationError → firstTimeSetup() 重新输入 key → continue
         → 其他错误 → 提示 → continue
```

## 注意事项 / 已知风险

| 风险 | 应对 |
|---|---|
| `DoneCodingCliGlobalConfig` 类型变更影响 `getGlobalConfig` 调用方 | 仅 config 模块的一个函数受影响，需确保 ASSETS_CONFIG_REPO_URL 仍正常工作 |
| `openai` SDK 的 baseURL 拼接 | 用户输入是 `https://api.deepseek.com`，SDK 自动加 `/v1`，需测试各模型的实际行为 |
| 401 认证失败 | 自动重新引导输入 API Key，不退出循环 |
| stream 中断 | 捕获网络异常，提示"连接中断"，不退出循环 |
| hijack 兼容 | chatHandler 用 xPrompts 做输入，天然兼容 |
