---
name: module-generate
description: Use when generating a code module (a list page, form page, or any module that matches a module template) into an existing project via the done-coding MCP module-template tools（生成代码模块：列表页 / 表单页等匹配模块模板的模块，经 done-coding MCP 模块模板工具配置驱动生成，非自由写码）. Drives the done_coding_gen_* module tools (list_module_templates / list_params / tree_build / tree_check) — config-driven, no freeform code authoring within the paradigm.
---

# 生成代码模块（module-generate / done-coding MCP 模块模板工具）

用 done-coding MCP 的**模块模板工具**（`done_coding_gen_list_module_templates` / `done_coding_gen_list_params` / `done_coding_gen_tree_build` / `done_coding_gen_tree_check`）把一个**代码模块**（列表页 / 表单页等匹配模块模板的模块）**配置驱动**地生成进现有 git 项目。AI 只填结构化配置（Recipe），不自由写码——正确性由「模板质量 × 配置正确性」决定，工具保证幂等 + 漂移可检出。

> **消费入口**：MCP 工具为主（agent 主消费面）；MCP 不可用/离线时用 CLI 兜底：
> - 本机已全局装 `dc-generator` → `dc-generator tree build --recipe <path>` / `dc-generator tree check --recipe <path>`。
> - 否则 `npx @done-coding/cli-generator tree build --recipe <path>`。

## 何时用（走工具 vs 自由写码）

**[MUST] 走工具（范式内）**：用户需求匹配某模块模板的 `whenToUse`（标准列表页 / 表单页等可复用范式）→ 填配置走 `tree_build`，**[MUST NOT] 自由写码**——避免范式漂移、防反模式堆积（这正是本工具的存在意义）。

**自由写码（范式外）**：需求不匹配任何模板 / 一次性定制无复用价值 / 该基座无对应模板 → 可自由写码，但先向用户说明「无匹配模板」。

**不确定** → 先探测（`list_module_templates`），探测为空则说明无模板，走自由写码或建议先提炼模板。

## 心智模型（三步）

1. **探测模板** `list_module_templates`：拿到该基座（base）下可用模块模板 + when-to-use。
2. **读参数契约** `list_params`：拿到选定模板的 `params`（JSON Schema）+ `defaults`（预制变量默认值）——单一事实源。
3. **填 Recipe 并生成** `tree_build`：按 schema 填 `vars` + 组装 `ops`，配置驱动物化 + manifest 入版控。

## 前置：确定 base + rootDir

- **`rootDir` = 用户项目根（[MUST] 必填）**——勿用 MCP server 进程 cwd（会落错目录）。tree 工具会对 rootDir 做 gitRoot 锚定（`git rev-parse --show-toplevel`，无 git 仓 fail-loud）。
- **`base` = 前端基座命名空间**（如 `admin-core`）。探测前与用户确认基座，或按项目前端技术栈判断；模板按基座分命名空间（机制通用、内容按基座分资产）。

## 步骤 1 — 探测可用模块模板

调 `done_coding_gen_list_module_templates`：

```json
{ "rootDir": "<项目根>", "base": "admin-core" }
```

返回各模板 `[{ name, base, layer, dir, whenToUse }]`（`layer` = 命中层 `project` / `parent` / `global`）。按 `whenToUse` 匹配用户需求选型。**[MUST NOT] 假设固定模板存在**——模板集由 `.done-coding/templates/<base>/` 文件系统发现派生（资产即列表），先探测再选。

## 步骤 2 — 读参数契约（单一事实源）

调 `done_coding_gen_list_params`：

```json
{ "rootDir": "<项目根>", "base": "admin-core", "template": "list-page" }
```

返回 `{ name, base, layer, whenToUse, params, defaults }`。`params` 即该模板的 `recipe.vars` 契约（JSON Schema，对象/数组为主；各模板字段不同，如 admin-core `list-page` 为 `name` / `title` / `rowType` / `api` / `columns` / `searchItems` / `operate` / `formModal` …）；`defaults` 为预制变量默认值。

**[MUST NOT] 照本文示例臆造字段或碎片名**——vars 以 `list_params` 返回的 schema 为准，碎片名以模板目录 `<base>/<template>/fragments/` 实有文件为准（`list_module_templates` 返回的 `dir` 下）。

判定规则：
- `params.properties` 列出全部 vars 及其类型/描述；`params.required` 列出必填项。
- **[MUST] 对齐 schema 填 `vars`**：缺 `required` 字段先向用户要，[MUST NOT] 臆造。
- `defaults` 可直接作为填充起点（预制变量）。

## 步骤 3 — 填 Recipe 并生成

组装模块 spec（一条标准 assemble Recipe），调 `done_coding_gen_tree_build`：

```json
{
  "rootDir": "<项目根>",
  "recipe": {
    "id": "user-list",
    "base": { "kind": "empty" },
    "output": "src/pages/system/user",
    "format": "prettier",
    "vars": { /* 对齐 list_params 的 params schema */ },
    "ops": [
      { "type": "addFragment", "id": "list", "source": "admin-core/list-page/fragments/List.vue.vm", "target": "List.vue", "render": true },
      { "type": "addFragment", "id": "config", "source": "admin-core/list-page/fragments/List.config.tsx.vm", "target": "List.config.tsx", "render": true }
    ]
  }
}
```

字段语义（据已实现机制）：
- `id`：产物稳定唯一 id（manifest 键）。
- `base`：`{kind:"empty"}`（拼装）或 `{kind:"dir", from, exclude?}`（裁剪）。
- `output`：产物落地目录，**相对 gitRoot**。
- `ops` 三类：
  - **`addFragment`**：引模板片段。`source` = `<base>/<template>/fragments/<file>`（如 `admin-core/list-page/fragments/List.vue.vm`），`render: true` 时变量点位用 `vars` 渲染。模板的哪些片段要引、各自依赖哪些 vars，以该模板 schema 描述为准（如 list-page 的 `FormModalItem.vue.vm` / `form.config.tsx.vm` 仅在填 `formModal` 时引入）。
  - **`writeFile`**：文件级内联字面内容（原样落盘，不渲染不改 EOL），用于类型/定制内容。
  - **`textPatch`**：注入现有项目文件（路由/菜单/export）。`target` = gitRoot 相对路径（如 `src/router/index.ts`），`markerKey` = 锚点 key（幂等成对 marker 块），`source` = 注入片段。**仅当模板提供注入片段时可用**——当前 admin-core 各模板均不含路由/菜单片段，路由注册由用户按项目惯例自行处理。
- `createTemplate` **仅项目级模板适用**——模块 Recipe 带它 tree build 会 fail-loud，[MUST NOT] 填。
- `format: "prettier"`（可选，**推荐目标项目有 prettier 时始终开**）：落盘前用**目标项目自己的 prettier**（`<rootDir>/node_modules/.bin/prettier` + 仓内配置）格式化产物；build/check 同径，格式化产物即漂移闸基线（不开则生成物折行可能与仓内 prettier 口径不一致，人工格式化后 `tree_check` 会报格式漂移）。目标项目未装 prettier 而声明此字段 → fail-loud。

需要验证产物未被手改漂移：调 `done_coding_gen_tree_check`（同 tree_build 的 `{ rootDir, recipe }` 入参）——clean regenerate 与已提交产物比对，任意漂移 `exitCode=1` / `drifted=true`。

## 行为约定（据已实现机制）

- **textPatch 注入目标文件必须已存在**（注入现有项目文件，不存在 fail-loud）；锚点多命中默认 fail（可显式 `anchorMatch:"first"` 降级）。
- **注入与页面物化同 build 事务**：先内存算注入、后统一 commit——任何错误 throw 前零落盘；marker 块幂等，重跑自愈。
- **rootDir 无 git 仓 → fail-loud**。
- **幂等**：同输入 build 两次 diff 为空；产物手改后 `tree_check` 漂移 fail。

## 完整示例（生成用户管理列表页）

> 示例 vars / 碎片名取自 admin-core `list-page` 实际 schema（基座 `@done-coding/admin-core ^0.33.0`）；模板升级后以 `list_params` 实时返回为准。可跑通的真实配方见 template-hub `scripts/module-templates-check/recipes/`。

1. **探测**：
```json
{ "rootDir": "/path/to/project", "base": "admin-core" }
```
→ `[{ "name": "form-page", … }, { "name": "list-detail-page", … }, { "name": "list-page", "layer": "global", "whenToUse": "标准列表页（ListLayout 空间）：搜索表单 + 表格 + 分页 + …" }, { "name": "tabs-page", … }]`

2. **选型 + 读参**：用户要「用户管理：列姓名/邮箱/状态/创建时间；按关键词、状态搜索；行内删除」→ 匹配 `list-page`：
```json
{ "rootDir": "/path/to/project", "base": "admin-core", "template": "list-page" }
```
→ `params.required` 为 `name` / `title` / `rowType` / `api` / `columns`；`properties` 另含 `searchItems` / `toolbar` / `operate` / `modals` / `handlerImpls` / `formModal` 等可选项。

3. **填 Recipe + 生成**：
```json
{
  "rootDir": "/path/to/project",
  "recipe": {
    "id": "user-list",
    "base": { "kind": "empty" },
    "output": "src/pages/system/user",
    "format": "prettier",
    "vars": {
      "name": "SystemUser",
      "title": "用户管理",
      "rowType": { "name": "SystemUser", "importFrom": "@/api/system/user" },
      "api": {
        "client": { "importName": "userApi", "importFrom": "@/api/system/user" },
        "list": { "mode": "standard", "method": "listUsers" }
      },
      "searchItems": [
        { "key": "keyword", "label": "关键词", "control": "input" },
        { "key": "status", "label": "状态", "control": "select", "options": [ { "label": "启用", "value": "on" }, { "label": "停用", "value": "off" } ] }
      ],
      "columns": [
        { "prop": "name", "label": "姓名" },
        { "prop": "email", "label": "邮箱", "render": { "kind": "textFallback" } },
        { "prop": "status", "label": "状态", "render": { "kind": "tag", "typeExpr": "row.status === \"on\" ? \"success\" : \"info\"", "labelExpr": "row.status === \"on\" ? \"启用\" : \"停用\"" } },
        { "prop": "createdAt", "label": "创建时间", "width": 180, "render": { "kind": "dateTime" } }
      ],
      "operate": {
        "width": 120,
        "buttons": [ { "key": "del", "label": "删除", "btnType": "danger", "handler": "onDelete", "confirm": { "title": "确认删除「${row.name}」？" } } ]
      },
      "handlerImpls": [ { "name": "onDelete", "kind": "api", "arg": "row", "callExpr": "userApi.deleteUser(row.id)", "successMsg": "已删除" } ],
      "pageImports": [ { "names": ["userApi"], "from": "@/api/system/user" } ]
    },
    "ops": [
      { "type": "addFragment", "id": "list", "source": "admin-core/list-page/fragments/List.vue.vm", "target": "List.vue", "render": true },
      { "type": "addFragment", "id": "config", "source": "admin-core/list-page/fragments/List.config.tsx.vm", "target": "List.config.tsx", "render": true }
    ]
  }
}
```
→ 物化 `src/pages/system/user/`（`List.vue` + `List.config.tsx`）+ manifest 入版控。需新建/编辑弹窗时再填 `modals` / `handlerImpls`（`kind: "evoke"`）/ `formModal`，并追加 `FormModalItem.vue.vm` / `form.config.tsx.vm` 两个 addFragment（参照 template-hub `list-page.full.json5`）。

4. **验证漂移**（可选）：
```json
{ "rootDir": "/path/to/project", "recipe": { /* 同上 recipe */ } }
```
（`tree_check`）→ 手改产物后返回 `drifted: true` / `exitCode: 1`。

## 速查

| 工具 | 入参 | 说明 |
|---|---|---|
| `done_coding_gen_list_module_templates` | `{ rootDir, base }` | 探测可用模块模板 + when-to-use（资产即列表） |
| `done_coding_gen_list_params` | `{ rootDir, base, template }` | 读模板参数契约 params（JSON Schema）+ defaults（单一事实源） |
| `done_coding_gen_tree_build` | `{ rootDir, recipe }` | 填 Recipe 配置驱动生成（物化 + 注入 + manifest） |
| `done_coding_gen_tree_check` | `{ rootDir, recipe }` | 项目内漂移闸（clean regenerate 比对，漂移 fail） |

CLI 兜底：`dc-generator tree build|check --recipe <path>`。
