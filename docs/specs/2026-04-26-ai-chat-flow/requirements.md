# 需求文档：AI 对话流程串通

> 状态：已审核通过
> 任务等级：Complex
> 日期：2026-04-26
> 参与角色：PM + 架构师 + 全栈开发专家 + 测试专家

## 背景

`@done-coding/cli-ai` 包已创建骨架（main.ts/handlers/types/utils），但仅有 `test` 子命令。主 CLI 的无子命令入口 `createChat` 是假实现（只回显用户输入）。需要接入真实 AI 对话能力。

## 功能需求

### REQ-1: 模型选择
WHEN 用户首次使用 AI 对话或执行 `/model` 命令
THE SYSTEM SHALL 展示预设模型列表（DeepSeek / 通义千问 / Kimi / Groq + 自定义选项），用户选择或输入自定义 API endpoint 后保存到配置
- 验收标准：预设列表至少包含 4 个模型；"自定义"选项可输入 model + baseUrl

### REQ-2: API Key 配置
WHEN 用户首次使用 AI 对话且 `~/.done-coding/config.json` 中无 AI_CONFIG
THE SYSTEM SHALL 交互式提示用户输入 API Key，与模型选择结果一起持久化
- 验收标准：key 写入 `~/.done-coding/config.json` 的 `AI_CONFIG.apiKey` 字段；后续对话自动读取，无需重复输入

### REQ-3: 配置持久化
WHEN AI_CONFIG 已存在于全局配置文件中
THE SYSTEM SHALL 直接读取已保存的配置进入对话，跳过模型选择和 key 输入
- 验收标准：第二次 `DC` 对话无需重新配置

### REQ-4: SSE 流式对话
WHEN 用户输入非内置命令的文本
THE SYSTEM SHALL 通过 OpenAI 兼容协议发送请求（使用 `openai` npm SDK），并以 SSE 流式逐 token 输出到终端
- 验收标准：token 无卡顿连续输出；流结束时换行等待下一轮输入

### REQ-5: 内置命令
WHEN 用户输入 `/exit`、`/model`、`/clear` 之一
THE SYSTEM SHALL 执行对应行为：
- `/exit`：结束对话
- `/model`：重新进入模型选择，更新全局配置
- `/clear`：清屏
- 验收标准：三个命令均可正常执行且不影响已保存配置

### REQ-6: 入口路由
WHEN 用户执行 `DC` 且无子命令
THE SYSTEM SHALL 提问"是否唤起 AI 对话？"，用户选 y 进入 AI 对话，选 n 输出 --help 内容
- 验收标准：y/n 分支正确；`createChat` 假实现被删除

### REQ-7: DC ai 子命令
WHEN 用户执行 `DC ai` 或 `DC ai chat`
THE SYSTEM SHALL 注册 chat 为 ai 子包的默认子命令，直接进入 AI 对话
- 验收标准：`DC ai` 可进入对话；`DC ai test` 仍可用

## 边界情况和约束

- 网络错误时友好提示，不退出对话循环
- API 返回错误（401/403/429 等）时输出错误信息到终端
- 空输入跳过，不发送 API 请求
- hijack 模式下 xPrompts 自动处理，不阻塞 AI agent
- 暂不支持多轮对话上下文（每次请求独立）
- Anthropic 模型暂不支持（用户选择时说明）

## 需求确认记录

| REQ | 确认 |
|---|---|
| REQ-1 | ✓ |
| REQ-2 | ✓ |
| REQ-3 | ✓ |
| REQ-4 | ✓ |
| REQ-5 | ✓ |
| REQ-6 | ✓ |
| REQ-7 | ✓ |
