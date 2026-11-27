# SNAPSHOT — template

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/template/README.md`。

## 技术快照

- 版本 0.14.0。`template init` 生成批量配置 `.done-coding/template.json`；`template batch`（或 `-b`）按其编译；create / generator / MCP 经 `batchCompileHandler` 传入配置复用。
- 裸 `template`：未给 `-e/-E/-i/-I` 且配置文件存在 → 按配置批量编译（init 产物可直接运行）；配置也不存在 → 说明批量与单文件两种用法；单文件参数不全 → 列出所缺参数。均为 `CliUserError`，不打调用栈（6zzib5，0.24.0 已发布）。
- 采集项：声明了 `initial` 的项交互与非交互都视为可选；非交互缺无 initial 的项时报错写明配置文件与 initial。
- 受限编译 `confineToRootDir`（ynfow5 评审缺陷，0.14.0 已发布）：调用方经 `compileTemplate` 第二参 / batch handler 参数开启后，配置文件、input、output、replace 编译后的文件名在读写 / 建目录前解开符号链接（含悬空链接、经目录链接的路径），越出 rootDir 即拒绝；模板配置项里写该字段不生效。缺省不开，`dc template` / generator / extract 行为不变；create 开启。判定函数 `assertInsideRootDir` 对外导出，create 读模板配置前复用。
- 测试：vitest 49 例（夹具在系统临时目录）。

## 业务快照

- 黑盒验收（组织站 rkacpj）路径：`template init` → `template` 已打通；非交互下默认配置的 name / chineseName 无 initial，需交互作答或在配置里补 initial。

## UX 快照

无 UI 面（命令行）。
