# SNAPSHOT — utils

> 文档定位：快照型 · 覆盖更新、只写当前状态；包依赖与架构见 `docs/TECH_SNAPSHOT.md`。

## 技术快照

- 版本 0.13.0。命令失败统一经 `failHandler` 输出到 stderr 并写日志。
- `CliUserError`：面向使用者的预期错误（缺配置、参数冲突、非交互缺输入），失败时只输出 message；按 `isCliUserError` 字段识别，兼容各包各带一份 utils 副本。其余 Error 仍附调用栈（6zzib5，未发布）。
- `CliInfo.epilog`：在 `--help` 末尾追加说明，独立 bin 与主命令子命令都生效。
- 测试：vitest 15 例。

## 业务快照

- 各包抛使用者可自行修正的错误时用 `CliUserError`；既有 `throw new Error` 未批量迁移。

## UX 快照

无 UI 面。
