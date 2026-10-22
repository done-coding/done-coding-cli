---
id: dyynp0
title: tree build 生成前校验：参数按模板 schema 校验 + 项目已装基座版本落在模板声明范围内
modules: [generator]
created: 2026-10-02
parent: ""
---

## 现状（2026-10-02 实测）

- 模板 `schema.json` 的 `params` 只用于 MCP 工具描述（`templates/discover.ts`），`tree build` **不按它校验**调用方填的参数：填错要等渲染报错或生成码出问题才暴露。
- 模板与基座（admin-core）无版本绑定：全局只有一份模板，业务仓装的 core 可能更旧或更新，生成码可能对不上其 API。

## 背景

admin-core 高频迭代（0.27 → 0.33 约两周）。已定方向：模板留在 template-hub，由 hub 钉住 core 版本、升级时跑一致性检查后跟进（hub 侧见投往 hub 的 issue）。cli 侧负责「生成那一刻」的两道机械闸，替代靠提示词约束 AI 填参。

## 要做

1. **参数校验**：`tree build`（含 MCP `tree_build`）按模板 `schema.json` 的 `params` 校验 recipe.vars；不通过 → 非零退出，列出全部违规字段（路径 + 期望 + 实际），零落盘。校验器走成熟 JSON Schema 库（按需评估，如 ajv），不手搓。
2. **基座版本闸**：`schema.json` 新增可选声明（形如 `base: { package, range }`）；声明时读**目标项目**已安装该包的版本（从项目 node_modules 解析），不在 range 内 → 拒绝生成并给出「升级 core / 换用对应版本模板」提示。未声明 → 不校验（兼容现有模板）。
3. `tree check` 同口径（版本不符时明确报出，而非报成内容漂移）。
