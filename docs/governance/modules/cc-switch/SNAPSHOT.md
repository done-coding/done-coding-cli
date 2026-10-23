# SNAPSHOT — cc-switch

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/cc-switch/README.md`；业务流程见 `docs/BUSINESS_SNAPSHOT.md`。

## 技术快照

- 版本 0.4.0（2026-10-23 发布，含 profile 缺失报错 / `--meta-generate` 说明文案修正）。
- 配置：`~/.done-coding/cc-switch/settings.json` 为唯一源（服务商内嵌模型 + `defaultProfile?` / `disabledDefault?` / `output.profileName?`）→ `--meta-generate` 编译为 `profile.json`（运行时读快照，600 权限）。provider.json / model.json 已废弃、不读不迁移。
- 选 profile：`--meta-profile` > 交互 pick（`--meta-pick` / `disabledDefault`）> `defaultProfile` > 无默认也 pick；非 TTY 需 pick 时报错退出。启动前 stdout 输出选中 profile 名，`--meta-silent` 压制。
- 注意同名不同物：env-guard 读的是 Claude Code 的 `~/.claude/settings.json`。
- 测试：vitest 135 例。

## 业务快照

- 取代：已退役的 `cli-mrm` 的服务商 / 模型管理。
- 消费方：直接使用者；`dex` 首次启动一次性导入其配置。

## UX 快照

命令行：启动前一行 profile 名；`--meta-*` 列表类输出 `name（provider）`。
