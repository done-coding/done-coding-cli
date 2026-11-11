---
id: 7ro00l
title: 模块模板探测合并多层，tree build 碎片根只取最近一层——项目层有 templates 时全局层模板列得出却读不到
modules: [generator]
created: 2026-11-09
---

## 现象

模块模板**探测**（`discoverTemplates` → `listDoneCodingDirs("templates")`，MCP `done_coding_gen_list_module_templates` / `list_params`）合并 project / parent / global 各层的 `.done-coding/templates/<base>/`，同名取近；`tree build/check` 的**碎片根**却是 `resolveDoneCodingDir("templates", { cwd: gitRoot })`，只取就近命中的**第一个** templates 根（`packages/generator/src/handlers/tree.ts` 碎片根解析处）。两者口径不一致。

## 复现

1. 全局层 `~/.done-coding/templates/admin-core/list-page/` 有模板（本机由 template-hub 软链分发）。
2. 目标项目 gitRoot 下建 `.done-coding/templates/forge/<某模板>/`（项目层只放了另一个基座）。
3. `list_module_templates { base: "admin-core" }` 照常列出 `list-page`（layer=global）。
4. 用该模板的配方 `tree build`：`addFragment.source = admin-core/list-page/fragments/...` 相对项目层 templates 根解析，碎片不存在 → 失败。

## 触发条件（何时下发）

有业务项目同时使用项目层与全局层的模块模板（如项目内自带某基座模板、又要用全局分发的另一基座模板）并因此受阻时下发。当前绕行：把所需基座软链或复制进项目层。

## 背景

批次 0cja0o 处理 yhk3m5 时实测发现，已在 module-generate skill 与 generator 领域快照写明，机制未改。修法方向（供分诊参考）：碎片解析按 `source` 首段 `<base>/<template>` 走与探测相同的多层就近查找，或探测只看碎片根同一层，二者择一保持一致。
