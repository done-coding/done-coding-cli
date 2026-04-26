# 需求文档：AI 对话流程串通

> 状态：已审核通过
> 任务等级：Complex
> 日期：2026-04-26
> 参与角色：PM + 架构师 + 全栈开发专家 + 测试专家

## 背景

`@done-coding/cli-ai` 包已创建骨架（main.ts/handlers/types）。主 CLI 的无子命令入口原先为 `createChat` 假实现（只回显用户输入）。需接入真实 AI 对话能力：选服务商 → 选模型 → 填 API Key → SSE 流式对话。

## 功能需求

### REQ-1: 模型选择（两级：服务商 → 模型）
WHEN 用户首次使用 AI 对话，或执行 `/provider`、`/model` 命令
THE SYSTEM SHALL 先展示预设服务商列表（DeepSeek / 通义千问 / Kimi / Groq + 自定义），选定服务商后展示该服务商下的模型列表供选择
- 验收标准：4 个预设服务商，每个至少 2 个模型；"自定义"服务商可输入 model + baseUrl
- DeepSeek 模型：deepseek-v4-flash / deepseek-v4-pro / deepseek-chat（弃用标注）/ deepseek-reasoner（弃用标注）

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
WHEN 用户输入 `/exit`、`/provider`、`/model`、`/clear` 之一
THE SYSTEM SHALL 执行对应行为：
- `/exit`：结束对话
- `/provider`：重新选择服务商 → 自动唤起模型选择（保留 API Key）
- `/model`：在当前服务商下切换模型（若为自定义 baseUrl 则走完整服务商+模型选择）
- `/clear`：清屏
- 验收标准：四个命令均可正常执行且不影响已保存配置

### REQ-6: 入口路由
WHEN 用户执行 `DC` 且无子命令
THE SYSTEM SHALL 提问"是否唤起 AI 对话？"，用户选 y 进入 AI 对话，选 n 输出 --help 内容
- 验收标准：y/n 分支正确；`createChat` 假实现被删除

### REQ-7: DC ai 子命令
WHEN 用户执行 `DC ai` 或 `DC ai chat`
THE SYSTEM SHALL 注册 chat 为 ai 子包的唯一子命令，直接进入 AI 对话
- 验收标准：`DC ai` 可进入对话；示例性质的 test 命令已移除

## 边界情况和约束

- 网络错误时友好提示，不退出对话循环
- API 返回 401 时自动重新引导用户输入 API Key（不退出对话循环）
- 其他 API 错误（403/429/500 等）时输出错误信息到终端，继续对话循环
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
