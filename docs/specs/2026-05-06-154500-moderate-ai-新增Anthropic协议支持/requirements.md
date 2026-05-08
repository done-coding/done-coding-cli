# 需求文档：AI 包新增 Anthropic 协议支持

> 状态：已审核通过
> 任务等级：Moderate
> 日期：2026-05-06
> 参与角色：PM + 全栈开发专家
> 审核状态：已通过

## 背景

当前 ai 包仅支持 OpenAI 协议（使用 `openai` npm SDK）。需新增 Anthropic 协议支持（使用 `@anthropic-ai/sdk`），通过 `/protocol` 命令切换协议。mrm 已内置两种协议的 providers。

## 功能需求

### REQ-1: 协议切换命令
WHEN 用户在聊天中输入 `/protocol`
THE SYSTEM SHALL 列出 OPENAI / ANTHROPIC 两个选项供用户选择
- 切换后清除旧的 model 和 baseUrl
- 将 protocol 写入 config 持久化

### REQ-2: 双协议流式对话
WHEN 用户发送聊天消息
THE SYSTEM SHALL 根据当前协议路由到对应 SDK
- `protocol=openai` → `openai` SDK（现有逻辑）
- `protocol=anthropic` → `@anthropic-ai/sdk`

### REQ-3: 协议感知的 /provider 和 /model
WHEN 用户切换协议后执行 `/provider` 或 `/model`
THE SYSTEM SHALL 列出当前协议下的服务商和模型
- `/provider` 仅列出当前协议的服务商
- `/model` 在当前协议的服务商下查找模型

### REQ-4: 对话头部显示协议
WHEN 进入对话循环
THE SYSTEM SHALL 在头部显示当前协议、模型和命令提示

## 技术约束
- 新增依赖 `@anthropic-ai/sdk: ^0.41.0`
- AiConfig 新增 `protocol?: string` 字段
- mrm 包不改动

## 需求确认记录
| REQ | 确认 |
|---|---|
| REQ-1 | ✅ |
| REQ-2 | ✅ |
| REQ-3 | ✅ |
| REQ-4 | ✅ |
