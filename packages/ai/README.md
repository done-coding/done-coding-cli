# @done-coding/cli-ai

AI 对话命令行工具 - 在终端中与 AI 大模型进行流式对话

[![npm version](https://badge.fury.io/js/@done-coding%2Fcli-ai.svg)](https://www.npmjs.com/package/@done-coding/cli-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 安装

### 独立安装

```bash
npm install @done-coding/cli-ai
# 或
pnpm add @done-coding/cli-ai
```

### 作为 done-coding CLI 的一部分

```bash
npm install -g @done-coding/cli
# 然后使用
DC ai
# 或直接无子命令进入
DC
```

## 快速开始

```bash
# 独立使用
dc-ai

# 作为主 CLI 的子命令
DC ai

# 或直接 DC 回车后选 y
DC

# 查看帮助
dc-ai --help
```

## 功能特性

- 🤖 **多服务商支持**: DeepSeek / 通义千问 / Kimi / Groq + 自定义服务商
- 🔐 **API Key 持久化**: 首次输入后保存到 `~/.done-coding/config.json`，后续自动使用
- 📡 **SSE 流式响应**: 逐 token 实时输出，体验接近 ChatGPT
- 🎯 **两级模型选择**: 先选服务商，再选该服务商下的具体模型
- ⌨️ **内置命令**: `/provider` 切换服务商、`/model` 切换模型、`/clear` 清屏、`/exit` 退出
- 🔄 **401 自动重试**: API Key 无效时自动重新引导输入

## API 文档

### 基础命令

#### `dc-ai chat`

启动 AI 对话（默认子命令，`dc-ai` 不加参数等同 `dc-ai chat`）

```bash
# 直接启动
dc-ai

# 显式指定
dc-ai chat
```

**内置命令**:

| 命令 | 说明 |
|---|---|
| `Ctrl+C` | 取消当前输入 |
| `/exit` | 退出对话 |
| `/provider` | 切换服务商（保留 API Key，自动引导选模型） |
| `/model` | 在当前服务商下切换模型 |
| `/clear` | 清屏 |

**预设服务商**:

| 服务商 | 可用模型 |
|---|---|
| DeepSeek | V4 Flash / V4 Pro / V3 Chat（弃用） / R1 Reasoner（弃用） |
| 通义千问 | Qwen Turbo / Qwen Plus / Qwen Max |
| Kimi（月之暗面） | Moonshot v1 8K / 32K / 128K |
| Groq | Llama 3.3 70B / Mixtral 8x7B |

**首次使用流程**: 选择模型服务商 → 选择具体模型 → 输入 API Key → 开始对话。

## 使用示例

### 基础使用场景

```bash
# 1. 通过主 CLI 启动（无子命令时）
DC
# 是否唤起 AI 对话？ → y
# 选择模型服务商 → DeepSeek
# 选择模型 → DeepSeek V4 Flash
# 输入 API Key → ****
# 输入消息开始对话 →

# 2. 通过 ai 子命令启动
DC ai

# 3. 独立 bin 启动
dc-ai

# 4. 切换服务商
# 在对话中输入 /provider

# 5. 切换模型（当前服务商下）
# 在对话中输入 /model
```

### 作为主 CLI 的一部分

```bash
# 使用主 CLI 命令
DC ai
DC ai chat

# 无子命令，选 y 进入
DC

# 使用替代命令
dc-cli ai
done-coding ai
```

## 配置

配置持久化到 `~/.done-coding/config.json` 的 `AI_CONFIG` 字段：

```json
{
  "AI_CONFIG": {
    "model": "deepseek-v4-flash",
    "apiKey": "sk-xxx",
    "baseUrl": "https://api.deepseek.com"
  }
}
```

## 依赖的工具包

本包集成了以下 done-coding CLI 工具：

- **@done-coding/cli-utils**: 通用工具函数（xPrompts、outputConsole、全局配置读写）
- **openai**: OpenAI 兼容 SDK（^4.x），负责 SSE 流式调用

## 故障排除

### 常见问题

**Q: 401 Authentication Fails**

```bash
# API Key 无效时会自动重新引导输入
# 检查 Key 是否正确
# 确认 Key 在对应服务商的有效期内
```

**Q: 网络请求超时**

```bash
# 检查网络连接
curl -I https://api.deepseek.com

# 确认对应服务商的 API 地址可访问
```

**Q: Token 输出中断**

```bash
# 重新进入对话即可，已保存的配置不会丢失
DC ai
```

## 贡献指南

我们欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m "feat: add amazing feature"`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/done-coding/done-coding-cli.git
cd done-coding-cli/packages/ai

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 本地开发测试
node es/cli.mjs --help

# 注意：本地使用 node + 入口文件，发布后使用 bin 命令名
# 功能完全一致，只是调用方式不同
```

## 许可证

MIT © [done-coding](https://github.com/done-coding)

## 相关链接

- [主 CLI 工具](https://www.npmjs.com/package/@done-coding/cli)
- [Github 仓库](https://github.com/done-coding/done-coding-cli)
