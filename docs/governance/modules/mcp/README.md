# 领域模块 — mcp

## 职责

MCP server 骨架（`dc-mcp`，stdio）：server 构建、传输、各领域工具 / 资源 / prompt 的注册入口。

## 落点

| 落点                                          | 说明                                 |
| --------------------------------------------- | ------------------------------------ |
| `packages/mcp`（除 `src/handlers/<领域>.ts`） | `@done-coding/cli-mcp`，bin `dc-mcp` |

## 领域边界

- 各领域 handler 文件归各自领域（create / generator）；本领域只管注册编排与 hijack 隔离（`processCreateByHijack: false`）。
