---
任务等级: Moderate
日期: 2026-05-06
审核状态: 已通过
---

# 任务清单

## TASK-1: AiConfig + types 更新

- [x] `packages/utils/src/cli-config.ts`：AiConfig 新增 `protocol?: string`
- [x] `packages/ai/src/types/index.ts`：ChatKeywordEnum 新增 `PROTOCOL`
- [x] 构建 utils ✓

## TASK-2: Anthropic SDK 集成

- [x] `packages/ai/package.json`：新增 `@anthropic-ai/sdk: ^0.41.0`
- [x] `packages/ai/src/services/api-client.ts`：新增 `streamChatAnthropic()` + 协议路由
- [x] 安装依赖 ✓

## TASK-3: chat.ts 协议支持

- [x] 新增 `getCurrentProtocol()` 替代硬编码 `AI_PROTOCOL`
- [x] 新增 `handleProtocolSwitch()`（/protocol 命令）
- [x] 对话头部显示当前协议
- [x] 首次配置保存 protocol
- [x] 构建 + lint ✓
