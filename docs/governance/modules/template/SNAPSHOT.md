# SNAPSHOT — template

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/template/README.md`。

## 技术快照

- 版本 0.12.2。`template init` 生成批量配置 `.done-coding/template.json`；`template batch`（或 `-b`）按其编译；create / generator / MCP 经 `batchCompileHandler` 传入配置复用。
- 裸 `template`：未给 `-e/-E/-i/-I` 且配置文件存在 → 按配置批量编译（init 产物可直接运行）；配置也不存在 → 说明批量与单文件两种用法；单文件参数不全 → 列出所缺参数。均为 `CliUserError`，不打调用栈（6zzib5，未发布）。
- 采集项：声明了 `initial` 的项交互与非交互都视为可选；非交互缺无 initial 的项时报错写明配置文件与 initial。
- 测试：vitest 40 例（夹具在系统临时目录）。

## 业务快照

- 黑盒验收（组织站 rkacpj）路径：`template init` → `template` 已打通；非交互下默认配置的 name / chineseName 无 initial，需交互作答或在配置里补 initial。

## UX 快照

无 UI 面（命令行）。
