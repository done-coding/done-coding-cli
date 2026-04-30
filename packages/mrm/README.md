# @done-coding/cli-mrm

AI 模型源管理器 - 管理 AI 服务商和模型的命令行工具，支持多协议、多客户端切换

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-mrm.svg)](https://www.npmjs.com/package/@done-coding/cli-mrm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-mrm
# 或
pnpm add @done-coding/cli-mrm
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC mrm [command]   # macOS/Linux
dc mrm [command]   # Windows
```

## 快速开始

```bash
# 查看可用模型
dc-mrm ls

# 切换模型
dc-mrm use deepseek-v4-pro[1m]

# 查看帮助
dc-mrm --help
```

## 核心概念

```
Protocol（协议） → Provider（服务商） → Model（模型）
```

| 概念 | 说明 |
|------|------|
| Protocol | API 协议，内置 `anthropic` / `openai` |
| Provider | 服务商，归属于某个 Protocol，包含 alias + baseUrl + apiKey + models |
| Model | AI 模型名，归属于某个 Provider |
| Client | 使用 API 的工具（claude-code / done-coding-ai），绑定一个 Protocol |

## 功能特性

- 📋 **模型列表**: 查看所有可用服务商和模型，支持扁平化和树状两种视角
- 🔀 **快速切换**: 一键切换模型，支持跨服务商切换
- ➕ **服务商管理**: 添加、删除自定义 API 服务商
- 🤖 **模型管理**: 为服务商添加或删除模型
- 💾 **状态持久化**: 服务商/模型选择按客户端记忆，切换回来自动恢复
- 🎨 **视觉标记**: 当前项绿色高亮，内置项紫色标记，1M 上下文模型标注

## API 文档

### 基础命令

#### `dc-mrm ls`

列出当前协议下所有可用模型

```bash
dc-mrm ls                  # 扁平化视图（默认）
dc-mrm ls --view=provider  # 树状视图
```

输出示例：

```
当前: claude-code → deepseek → deepseek-v4-pro[1m]

  haiku                   anthropic (anthropic) [内置]
  sonnet                  anthropic (anthropic) [内置]
* deepseek-v4-pro[1m]     deepseek (anthropic) [内置]
  deepseek-v4-flash[1m]   deepseek (anthropic) [内置]
  deepseek-chat           deepseek (anthropic) [内置]
```

#### `dc-mrm use <model>`

切换模型（快捷命令，同 `model use`）

```bash
dc-mrm use deepseek-v4-flash[1m]
# 已切换 → 当前: claude-code → deepseek → deepseek-v4-flash[1m]
```

#### `dc-mrm model use <model> [--provider=<alias>]`

切换模型，可选跨服务商

```bash
dc-mrm model use sonnet
dc-mrm model use gpt-4o --provider=openai
```

#### `dc-mrm model add <providerAlias> <modelName>`

给服务商添加模型（支持批量空格分隔）

```bash
dc-mrm model add deepseek custom-model-1
dc-mrm model add openai gpt-4-turbo gpt-4-vision
```

#### `dc-mrm model remove <providerAlias> <modelName>`

删除服务商的模型

```bash
dc-mrm model remove deepseek custom-model-1
```

内置模型不可删除。

#### `dc-mrm provider use <alias>`

切换服务商

```bash
dc-mrm provider use anthropic
```

#### `dc-mrm provider add <alias> <url>`

添加自定义服务商（交互式输入 API Key 和模型列表）

```bash
dc-mrm provider add my-api https://api.example.com
# 请输入 API Key: ***
# 输入该服务商支持的模型: model-a model-b
```

#### `dc-mrm provider remove <alias>`

删除自定义服务商（内置服务商不可删除）

```bash
dc-mrm provider remove my-api
```

#### `dc-mrm switch <client>`

切换当前客户端

```bash
dc-mrm switch claude-code
dc-mrm switch done-coding-ai
```

## 内置数据

### 内置 Client

| client | protocol | 默认 provider |
|--------|----------|-------------|
| claude-code | anthropic | anthropic |
| done-coding-ai | openai | deepseek |

### 内置 Provider

**Anthropic 协议：**

| alias | 模型 |
|-------|------|
| anthropic | haiku, sonnet, opus |
| deepseek | deepseek-v4-pro[1m], deepseek-v4-flash[1m], deepseek-chat, deepseek-reasoner |

**OpenAI 协议：**

| alias | 模型 |
|-------|------|
| openai | gpt-4o, gpt-4o-mini |
| deepseek | deepseek-v4-pro[1m], deepseek-v4-flash[1m], deepseek-chat, deepseek-reasoner |
| qwen | qwen-turbo, qwen-plus, qwen-max |
| kimi | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k |

## 配置

注册表存储在 `~/.done-coding/mrm/sources.json`，客户端配置由 `provider use` / `model use` 自动写入：

- claude-code → `~/.claude/settings.json`
- done-coding-ai → `~/.done-coding/config.json`

## 编程接口

```javascript
import {
  handler,
  lsHandler,
  switchHandler,
  providerAddHandler,
  providerUseHandler,
  providerRemoveHandler,
  modelAddHandler,
  modelRemoveHandler,
  modelUseHandler,
} from "@done-coding/cli-mrm";

// 程序化调用
await handler("model use", { model: "sonnet" });
await handler("ls", { view: "model" });
```

## 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/done-coding/done-coding-cli.git
cd done-coding-cli/packages/mrm

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 本地测试
node es/cli.mjs ls
```

## 许可证

MIT © [done-coding](https://github.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
- [更新日志](./CHANGELOG.md)
