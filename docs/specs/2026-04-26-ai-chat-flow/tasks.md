# AI 对话流程串通 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `DC` 无子命令 → 选模型 → 填 key → SSE 流式 AI 对话的完整链路

**Architecture:** 方案 A — AI 逻辑全在 `packages/ai`，cli 只做入口路由。使用 `openai` SDK 抹平各模型 API 差异。配置持久化到 `~/.done-coding/config.json`。

**Tech Stack:** TypeScript, yargs, openai ^4.x, Vite, pnpm workspace

---

### Task 1: utils 全局配置类型升级

**Files:**
- Modify: `packages/utils/src/cli-config.ts`

- [ ] **Step 1: 新增 AiConfig 类型 + 升级 DoneCodingCliGlobalConfig + 导出 getGlobalConfigFilePath**

将文件中的类型定义替换为：

```typescript
/** AI 配置 */
export type AiConfig = {
  /** 模型名称，如 "deepseek-chat" */
  model: string;
  /** API Key */
  apiKey: string;
  /** API Base URL，如 "https://api.deepseek.com" */
  baseUrl: string;
};
```

`DoneCodingCliGlobalConfigKeyEnum` 新增：

```typescript
export enum DoneCodingCliGlobalConfigKeyEnum {
  /** 资产配置仓库 */
  ASSETS_CONFIG_REPO_URL = "ASSETS_CONFIG_REPO_URL",
  /** AI 对话配置 */
  AI_CONFIG = "AI_CONFIG",
}
```

`DoneCodingCliGlobalConfig` 类型改为：

```typescript
/** done-coding-cli 全局配置 */
export type DoneCodingCliGlobalConfig = {
  [DoneCodingCliGlobalConfigKeyEnum.ASSETS_CONFIG_REPO_URL]: string;
  [DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG]?: AiConfig;
};
```

`getGlobalConfig` 函数替换默认值部分，适配新类型：

```typescript
const getGlobalConfig = async (): Promise<DoneCodingCliGlobalConfig> => {
  const filePath = getGlobalConfigJsonFilePath();

  const config: DoneCodingCliGlobalConfig = {
    [DoneCodingCliGlobalConfigKeyEnum.ASSETS_CONFIG_REPO_URL]:
      ASSETS_CONFIG_REPO_URL_DEFAULT,
    [DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG]: undefined,
  };
  try {
    if (await assetIsExitsAsync(filePath)) {
      const fileConfig = await readJsonFileAsync<Partial<DoneCodingCliGlobalConfig>>(
        filePath,
        {},
      );
      Object.entries(fileConfig).forEach(([key, value]) => {
        (config as any)[key] = value;
      });
    }
  } catch (error) {}

  return config;
};
```

将 `getGlobalConfigJsonFilePath` 从 `const` 改为 `export const`：

```typescript
/** 【全局】获取全局配置文件路径 */
export const getGlobalConfigFilePath = () => {
  return path.resolve(homedir(), DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH);
};
```

同时更新函数内部引用 `getGlobalConfigJsonFilePath` → `getGlobalConfigFilePath`。

- [ ] **Step 2: Commit**

```bash
git add packages/utils/src/cli-config.ts
git commit -m "feat(utils): 新增 AI_CONFIG 配置键和 AiConfig 类型，升级全局配置类型为按 key 定义值类型"
```

---

### Task 2: ai 包模型预设列表 + 关键字枚举

**Files:**
- Create: `packages/ai/src/services/model-presets.ts`
- Modify: `packages/ai/src/types/index.ts`

- [ ] **Step 1: 新增 ChatKeywordEnum 到 types**

`packages/ai/src/types/index.ts`：

```typescript
/** 子命令枚举 */
export enum SubcommandEnum {
  /** 测试命令 */
  TEST = "test",
  /** AI 对话 */
  CHAT = "chat",
}

/** 对话内置关键字 */
export enum ChatKeywordEnum {
  /** 退出对话 */
  EXIT = "/exit",
  /** 切换模型 */
  MODEL = "/model",
  /** 清屏 */
  CLEAR = "/clear",
}

export interface TestOptions {
  /** 测试选项 */
  xx: string;
}
```

- [ ] **Step 2: 创建模型预设服务**

`packages/ai/src/services/model-presets.ts`：

```typescript
import type { AiConfig } from "@done-coding/cli-utils";

/** 预设模型条目（继承 AiConfig 配置字段，附加展示标签） */
export type ModelPreset = {
  /** 用户可见的展示名称 */
  label: string;
} & AiConfig;

/** 自定义模型选项的索引值 */
export const CUSTOM_PRESET_INDEX = -1;

/** 自定义模型的展示标签文本 */
export const CUSTOM_PRESET_LABEL = "自定义...";

/** 预设模型列表（不含 apiKey，用户需自行输入） */
export const MODEL_PRESETS: ModelPreset[] = [
  {
    label: "DeepSeek V3",
    model: "deepseek-chat",
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
  },
  {
    label: "通义千问",
    model: "qwen-turbo",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
  },
  {
    label: "Kimi",
    model: "moonshot-v1-8k",
    apiKey: "",
    baseUrl: "https://api.moonshot.cn",
  },
  {
    label: "Groq",
    model: "llama-3.3-70b",
    apiKey: "",
    baseUrl: "https://api.groq.com/openai",
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types/index.ts packages/ai/src/services/model-presets.ts
git commit -m "feat(ai): 添加 ChatKeywordEnum 枚举和模型预设列表服务"
```

---

### Task 3: ai 包 API 客户端

**Files:**
- Create: `packages/ai/src/services/api-client.ts`

- [ ] **Step 1: 创建流式 API 客户端**

```typescript
import OpenAI from "openai";
import type { AiConfig } from "@done-coding/cli-utils";

/** 流式聊天请求参数 */
export type StreamChatParams = {
  /** AI 配置 */
  config: AiConfig;
  /** 用户消息 */
  message: string;
  /** token 回调 */
  onToken: (token: string) => void;
};

/** SSE 流式聊天：逐 token 回调 onToken */
export const streamChat = async (params: StreamChatParams): Promise<void> => {
  const { config, message, onToken } = params;

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl.endsWith("/v1")
      ? config.baseUrl
      : config.baseUrl + "/v1",
  });

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: message }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onToken(content);
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/ai/src/services/api-client.ts
git commit -m "feat(ai): 添加基于 openai SDK 的 SSE 流式 API 客户端"
```

---

### Task 4: ai 包 chat handler + handlers 路由

**Files:**
- Create: `packages/ai/src/handlers/chat.ts`
- Modify: `packages/ai/src/handlers/index.ts`

- [ ] **Step 1: 创建 chat handler**

`packages/ai/src/handlers/chat.ts`：

```typescript
import type { SubCliInfo } from "@done-coding/cli-utils";
import {
  outputConsole,
  xPrompts,
  readJsonFileAsync,
  getGlobalConfigFilePath,
  DoneCodingCliGlobalConfigKeyEnum,
} from "@done-coding/cli-utils";
import type { DoneCodingCliGlobalConfig, AiConfig } from "@done-coding/cli-utils";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SubcommandEnum, ChatKeywordEnum } from "@/types";
import {
  MODEL_PRESETS,
  CUSTOM_PRESET_INDEX,
  CUSTOM_PRESET_LABEL,
} from "@/services/model-presets";
import { streamChat } from "@/services/api-client";

/**
 * 读取全局配置文件
 * @returns 全局配置对象，文件不存在时返回空对象
 */
const readGlobalConfig = async (): Promise<DoneCodingCliGlobalConfig> => {
  try {
    return await readJsonFileAsync<DoneCodingCliGlobalConfig>(
      getGlobalConfigFilePath(),
      {} as DoneCodingCliGlobalConfig,
    );
  } catch {
    return {} as DoneCodingCliGlobalConfig;
  }
};

/**
 * 写入全局配置文件（目录不存在时自动创建）
 * @param config 全局配置对象
 */
const writeGlobalConfig = async (config: DoneCodingCliGlobalConfig) => {
  const filePath = getGlobalConfigFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
};

/**
 * 首次引导流程：展示预设模型列表 → 用户选择（含自定义） → 输入 API Key
 * @returns AiConfig 配置对象，用户取消时返回 null
 */
const firstTimeSetup = async (): Promise<AiConfig | null> => {
  const choices = MODEL_PRESETS.map((p, i) => ({
    title: `${p.label} (${p.baseUrl})`,
    value: i,
  }));
  choices.push({ title: CUSTOM_PRESET_LABEL, value: CUSTOM_PRESET_INDEX });

  const { modelIndex } = await xPrompts({
    type: "select",
    name: "modelIndex",
    message: "选择大模型",
    choices,
  });

  let model: string;
  let baseUrl: string;

  if (modelIndex === CUSTOM_PRESET_INDEX) {
    const custom = await xPrompts([
      { type: "text", name: "model", message: "输入模型名" },
      { type: "text", name: "baseUrl", message: "输入 API Base URL" },
    ]);
    model = custom.model;
    baseUrl = custom.baseUrl;
  } else {
    model = MODEL_PRESETS[modelIndex].model;
    baseUrl = MODEL_PRESETS[modelIndex].baseUrl;
  }

  const { apiKey } = await xPrompts({
    type: "password",
    name: "apiKey",
    message: "输入 API Key",
    validate: (v: string) =>
      v?.trim().length > 0 ? true : "API Key 不能为空",
  });

  return { model, apiKey, baseUrl };
};

/**
 * AI 对话主处理器
 * 流程：读取配置 → 首次引导（如需） → 对话循环（xPrompts 交互 + SSE 流式响应）
 */
const chatHandler = async () => {
  let config = await readGlobalConfig();
  let aiConfig = config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG];

  // 首次配置
  if (!aiConfig?.apiKey) {
    outputConsole.log("首次使用需配置模型和 API Key\n");
    const result = await firstTimeSetup();
    if (!result) return;

    aiConfig = result;
    config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
    await writeGlobalConfig(config);
    outputConsole.log("");
  }

  outputConsole.log(
    `模型: ${aiConfig.model} | 输入消息开始对话 (${ChatKeywordEnum.EXIT} 退出, ${ChatKeywordEnum.MODEL} 切换模型, ${ChatKeywordEnum.CLEAR} 清屏)\n`,
  );

  // 对话循环
  while (true) {
    const { input } = await xPrompts({
      type: "text",
      name: "input",
      message: "",
      validate: () => true,
    });

    const trimmed = (input as string)?.trim();

    if (!trimmed) continue;

    if (trimmed === ChatKeywordEnum.EXIT) {
      outputConsole.log("对话结束");
      return;
    }

    if (trimmed === ChatKeywordEnum.MODEL) {
      const result = await firstTimeSetup();
      if (result) {
        aiConfig = result;
        config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
        await writeGlobalConfig(config);
        outputConsole.log(`已切换至 ${aiConfig.model}\n`);
      }
      continue;
    }

    if (trimmed === ChatKeywordEnum.CLEAR) {
      process.stdout.write("\x1b[2J\x1b[0f");
      continue;
    }

    // 发送 AI 请求
    outputConsole.stage("思考中...");
    try {
      await streamChat({
        config: aiConfig,
        message: trimmed,
        onToken: (token) => process.stdout.write(token),
      });
      process.stdout.write("\n");
    } catch (error: any) {
      outputConsole.error(`请求失败: ${error?.message || error}`);
    }
  }
};

/** yargs 子命令注册信息 */
export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.CHAT,
  describe: "AI 对话",
  handler: chatHandler as SubCliInfo["handler"],
};

export const handler = chatHandler;
```

- [ ] **Step 2: 注册 chat 到 handlers/index.ts**

`packages/ai/src/handlers/index.ts`：

```typescript
import {
  handler as testHandler,
  commandCliInfo as testCommandCliInfo,
} from "./test";
import {
  handler as chatHandler,
  commandCliInfo as chatCommandCliInfo,
} from "./chat";
import injectInfo from "@/injectInfo.json";
import { SubcommandEnum } from "@/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
} from "@done-coding/cli-utils";

export { testHandler, testCommandCliInfo, chatHandler, chatCommandCliInfo };

/** 导出供外部 export使用， cli内部不会通过改方法调用各子命令方法 */
export const handler = async (
  command: SubcommandEnum,
  argv: CliHandlerArgv<any>,
) => {
  switch (command) {
    case SubcommandEnum.TEST: {
      return testHandler(argv);
    }
    case SubcommandEnum.CHAT: {
      return chatHandler(argv);
    }
    default: {
      throw new Error(`不支持的命令 ${command}`);
    }
  }
};

const { version, description: describe } = injectInfo;

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [testCommandCliInfo, chatCommandCliInfo].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/handlers/chat.ts packages/ai/src/handlers/index.ts
git commit -m "feat(ai): 新增 chat 子命令 — 选模型/填 key/SSE 流式对话"
```

---

### Task 5: ai 包添加 openai 依赖

**Files:**
- Modify: `packages/ai/package.json`

- [ ] **Step 1: 添加依赖 + 导出新模块**

`packages/ai/package.json` 的 `dependencies` 中新增：

```json
"dependencies": {
  "@done-coding/cli-utils": "workspace:0.8.4",
  "openai": "^4.77.0"
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/supengfei/Documents/code/project/done-coding-cli && pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/package.json pnpm-lock.yaml
git commit -m "chore(ai): 添加 openai SDK 依赖"
```

---

### Task 6: cli 入口路由替换 createChat

**Files:**
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: 删除 createChat，替换为 AI 入口路由**

删除 `chalk` import（不再需要），删除整个 `createChat` 函数，将 `handler()` 替换为：

```typescript
import { createAsSubcommand as createInjectCommand } from "@done-coding/cli-inject";
import { createAsSubcommand as createExtractCommand } from "@done-coding/cli-extract";
import { createAsSubcommand as createGitCommand } from "@done-coding/cli-git";
import { createAsSubcommand as createCreateCommand } from "create-done-coding";
import { createAsSubcommand as createPublishCommand } from "@done-coding/cli-publish";
import { createAsSubcommand as createTemplateCommand } from "@done-coding/cli-template";
import { createAsSubcommand as createComponentCommand } from "@done-coding/cli-component";
import { createAsSubcommand as createConfigCommand } from "@done-coding/cli-config";
import {
  createAsSubcommand as createAiCommand,
  handler as aiHandler,
} from "@done-coding/cli-ai";
import { SubcommandEnum as AiSubcommandEnum } from "@done-coding/cli-ai";
import injectInfo from "@/injectInfo.json";
import type { CliInfo } from "@done-coding/cli-utils";
import {
  createMainCommand,
  getRootScriptName,
  execSyncHijack,
  xPrompts,
} from "@done-coding/cli-utils";

const { version, description: describe } = injectInfo;

const commandCliInfo: CliInfo = {
  usage: `$0 <command> [options]`,
  describe,
  version,
  subcommands: [
    createGitCommand(),
    createCreateCommand(),
    createInjectCommand(),
    createExtractCommand(),
    createPublishCommand(),
    createTemplateCommand(),
    createComponentCommand(),
    createConfigCommand(),
    createAiCommand(),
  ],
  demandCommandCount: 0,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
  async handler() {
    const { shouldChat } = await xPrompts({
      type: "confirm",
      name: "shouldChat",
      message: "是否唤起 AI 对话？",
      initial: true,
    });

    if (shouldChat) {
      await aiHandler(AiSubcommandEnum.CHAT, {});
    } else {
      execSyncHijack(`node ${process.argv[1]} --help`, {
        stdio: "inherit",
      });
    }
  },
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand(commandCliInfo);
};
```

- [ ] **Step 2: 更新 cli/src/index.ts 导出 SubcommandEnum**

`packages/cli/src/index.ts` 中的 ai 导出需新增 `SubcommandEnum`：

```typescript
export {
  createAsSubcommand as createAiCommand,
  handler as aiHandler,
  SubcommandEnum as AiSubcommandEnum,
} from "@done-coding/cli-ai";
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/main.ts packages/cli/src/index.ts
git commit -m "feat(cli): 替换 createChat 假实现为 AI 对话入口路由"
```

---

### Task 7: 构建与验证

- [ ] **Step 1: 构建所有包**

```bash
cd /Users/supengfei/Documents/code/project/done-coding-cli && pnpm run build
```

Expected: 所有包构建成功，无 TypeScript 错误。

- [ ] **Step 2: 验证 ai 包 CLI 入口可用**

```bash
node packages/ai/es/cli.mjs --help
```

Expected: 输出中包含 `chat  AI 对话` 子命令。

- [ ] **Step 3: 验证主 CLI 入口可用**

```bash
node packages/cli/es/cli.mjs --help
```

Expected: 输出包含 `ai` 子命令；无子命令时显示 `是否唤起 AI 对话？` 提示（需要实际终端才能测试交互，这里仅验证不报错）。

- [ ] **Step 4: Commit（如有 lint 自动修复）**

```bash
git status
# 如有lint-staged自动修复的文件，add并commit
```

---

---
## 变更记录

> 以下变更在实施过程中根据用户反馈产生，已同步更新 requirements.md 和 design.md。

| # | 日期 | 变更 | 影响范围 |
|---|---|---|---|
| 1 | 2026-04-26 | 模型选择从一级改为两级（服务商 → 模型） | model-presets.ts, chat.ts |
| 2 | 2026-04-26 | 新增 `/provider` 关键字（选服务商+模型，保留 key） | types/index.ts, chat.ts |
| 3 | 2026-04-26 | `/model` 改为在当前服务商下切换模型 | chat.ts |
| 4 | 2026-04-26 | 移除示例性质 test 命令及相关类型 | test.ts, types/index.ts, handlers/index.ts |
| 5 | 2026-04-26 | 401 错误时重新引导输入 API Key（不退出循环） | chat.ts |
| 6 | 2026-04-26 | `outputConsole.log` → `outputConsole.info`（原方法不存在） | chat.ts |
| 7 | 2026-04-26 | `TS18048` aiConfig 可能 undefined + ESLint 类型断言警告修复 | chat.ts |
