---
id: cjunp5
title: generator 配方 format 是否支持 "ruff"（Python 产物生成后格式化）
created: 2026-11-12
from: done-coding-template-hub
---

## 现象

`generator tree` / `assemble` 配方的 `format` 只接受 `"prettier"`（`packages/generator/src/assemble/recipe.ts`：「format 仅支持 "prettier"」）。Python 产物（template-hub `module-templates/py-fastapi/*`）没有生成后格式化的入口，模板渲染出的行长取决于契约字段名与枚举值长短，消费工程的 `ruff check`（E501，100 列）/ `ruff format --check` 会失败。

template-hub 已两次遇到：buzces（单元素元组）、hcf5r6（长字段名 / 长枚举超 100 列，生成工程 `uv run poe check` 失败）。hub 侧当前的解法是模板一律按「一参一行带尾逗号（magic trailing comma）」渲染，使 ruff format 原样保留；但单个超长字符串字面量（例如超长的排序串、超长 alias）仍无法由模板折行。

## 复现

1. 任一含较长字段名的 resource-spec 契约 → `dc-resource-backend --store` → `dc-generator tree build`（hub b1fcbf9 之前的模板即可复现）。
2. 在 py-fastapi 成员内 `uv run ruff format --check src`：生成的 `dto.py` / `router.py` would be reformatted；`ruff check` 报 E501。

## 期望（询问是否可加）

配方 `format` 增加 `"ruff"`：对产物中的 `*.py` 执行目标项目自己的 `ruff format`（就近 `pyproject.toml` 的 `[tool.ruff]`，按 venv / `uv run` 等方式定位 ruff，找不到即报错而非静默跳过），`tree check` 以格式化后的产物为基准（与现有 prettier 语义一致）。若不打算支持，请在 DROPPED 写明理由，hub 继续用模板侧的 magic trailing comma 方案。

## 来源

done-coding-template-hub 批次 a217tm（hcf5r6，business-code-studio 生成工程后端门禁失败）；总协调 blueprint 要求顺带询问 cli 侧能力。
