# SNAPSHOT — generator

> 文档定位：快照型 · 覆盖更新、只写当前状态。结构 / 契约细节唯一载体 = `docs/TECH_SNAPSHOT.md`「cli-generator 内部结构」，本文件只写治理视图。

## 技术快照

- 版本 0.3.0（2026-10-23 发布，含 codegen-unified 合入：writeFile / tree / 注入 / 模板资产 / formatter，及 R4 修复）。
- 能力面：批次（add / modify / remove / list / init）· assemble（plan / build / diff / check，6 内建 op）· tree（build / check）· 模块模板发现 · `recipe.format: "prettier"`。
- 计划期：addFragment 目录铺开按文件声明效果，delete 类 op 可作用于铺出的文件（0.3.0 已发布，hub 配方的单铺规避可删，已向 hub 提 issue）。
- 测试：vitest 393 例（`forks` 池 + globalSetup 隔离宿主 HOME，本机有全局 `~/.done-coding/templates` 亦不受影响）；跨仓回归 `pnpm test:hub`（本地构建对 template-hub 22 配方跑漂移闸）。
- 遗留：`ehzjoy` 产物目录与手写文件混住；`gl1ytl` 页面级 / 模板级碎片 fragmentRoot 分层。

## 业务快照

- 消费方：template-hub（assemble 配方，钉 0.2.0）、业务仓模块生成（tree + admin-core 四模板，经 `~/.done-coding/templates/admin-core` symlink 到 hub）。
- AI 入口：MCP `done_coding_gen_*`（批次 5 个 + 模块模板 / tree 4 个）、skill `cli-generator` / `module-generate`（示例对齐 admin-core list-page 真实碎片与 schema，vars 以 `list_params` 为准）、Dex 内置工具。

## UX 快照

无 UI 面（命令行 / MCP）。
