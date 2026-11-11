---
id: dhokbr
title: tree 基座版本闸支持非 npm 基座（如 Python fastapi）
modules: [generator]
created: 2026-11-06
parent: dyynp0
---

## 现状（2026-11-06，批次 3r4dvv 交付后）

- `tree build/check` 的基座闸只从项目 `node_modules/<package>/package.json` 读已装版本；找不到时告警并跳过。
- template-hub 的 `module-templates/py-fastapi/resource/schema.json` 已声明 `base: { package: "fastapi", range: ">=0.115.0 <1.0.0" }`，这类 Python 基座目前只告警、不校验。

## 待定

- schema 如何表达生态（如新增 `base.ecosystem: "npm" | "pypi"`，或按包名约定），需与 template-hub 对齐契约。
- Python 已装版本的来源（项目虚拟环境 dist-info、`uv.lock` / `poetry.lock` / `requirements` 锁定版本），以哪个为准。
- 找不到已装版本时，是否应改为拒绝生成（当前为告警，避免阻断现有 Python 模板）。

## 退回需求池（2026-11-08）

- 曾随批次 kuu662 → ngco25 下发，未开工即撤回（77a9c0d）；用户 2026-11-07 表示不记得有此需求。
- 重新下发的触发条件：有非 npm 基座（如 py-fastapi）的模块模板进入业务仓实际生成，且基座版本不符造成返工，并重新提出。
