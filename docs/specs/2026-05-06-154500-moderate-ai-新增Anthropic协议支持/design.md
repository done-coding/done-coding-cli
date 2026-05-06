---
任务等级: Moderate
日期: 2026-05-06
审核状态: 已通过
reviewer: PM + 老板
---

# 技术设计文档：AI 包新增 Anthropic 协议支持

## 变更范围

| 类别 | 文件 |
|------|------|
| **Direct Targets** | `packages/ai/package.json`、`packages/ai/src/services/api-client.ts`、`packages/ai/src/handlers/chat.ts`、`packages/ai/src/types/index.ts`、`packages/utils/src/cli-config.ts` |
| **Out-of-Scope** | mrm 包不改动 |

## 关键技术点

### 1. api-client.ts 双协议路由

```typescript
export const streamChat = async (params: StreamChatParams) => {
  if (params.config.protocol === Protocol.ANTHROPIC) {
    return streamChatAnthropic(params);  // @anthropic-ai/sdk
  }
  return streamChatOpenAI(params);       // openai SDK（默认）
};
```

- `streamChatOpenAI`：现有逻辑，`openai` SDK SSE 流式
- `streamChatAnthropic`：新增，`@anthropic-ai/sdk` messages.stream()

### 2. chat.ts 动态协议

- `getCurrentProtocol()` 从 config 读取 protocol，默认 OPENAI
- 所有 mrm 调用透传 `await getCurrentProtocol()`
- `/protocol` 切换机制：xPrompts → 选值 → 写 config + 清 model/baseUrl

### 3. AiConfig 新增 protocol 字段

```typescript
export interface AiConfig {
  protocol?: string;  // "openai" | "anthropic"
  model: string;
  apiKey: string;
  baseUrl: string;
}
```

### 4. 切换协议时的清理逻辑

切换 protocol 时删除旧 model/baseUrl（不同协议的 provider 不可共用），下次 `/provider` `/model` 重新选择。
