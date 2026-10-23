# SNAPSHOT — mcp

> 文档定位：快照型 · 覆盖更新、只写当前状态。数据流唯一载体 = `docs/TECH_SNAPSHOT.md`「MCP server 数据流」。

## 技术快照

- 版本 0.6.0（2026-10-23 发布）。`main.ts` 注册：create（Tools / Resources / Prompts）· generator 批次（Tools / Prompts）· 模块模板（`registerModuleTemplateTools`）。
- 工具描述：模块模板类由模板 schema 动态生成；所有工具返回经 `toJsonResult` 包装 JSON，stdout 不承载日志。
- 测试：vitest 28 例（`forks` 池 + globalSetup 隔离宿主 HOME）。

## 业务快照

- 消费方：Claude Code 等 MCP 客户端；与 cli-skills 的 skill 文档互指。

## UX 快照

无 UI 面。
