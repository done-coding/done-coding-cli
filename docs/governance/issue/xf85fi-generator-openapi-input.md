---
id: xf85fi
title: generator 没有以 OpenAPI 文档为输入的生成能力，生成调用层只能各仓接外部工具
created: 2026-11-16
from: done-creating-ledger
---

## 现象

blueprint 0042 ⓒ 要求由接口文档（OpenAPI）生成前端调用层与类型，生成物放 `generated/`、不手改、可重跑。done-coding cli 的 generator 目前没有以 OpenAPI 文档为输入的生成能力：只读检查 done-coding 各仓（2026-11-16），没有找到 OpenAPI 到 TypeScript 的生成器。identity 的 resource-spec 编译只覆盖带 x-dc 资源扩展的五操作资源。

ledger 试点（op4a2g）只好用外部的 openapi-typescript 7.13.0（MIT），从入仓的 `openapi.json` 生成 `src/generated/ledger-api.d.ts`。漂移检查用它自带的 `--check`，没有纳入 generator 的 tree check、manifest 与配方体系。往后每个仓都要自己接一遍。

## 复现

在 done-creating-ledger 的 `frontend/apps/ledger-admin` 查看 `package.json` 的 `generate:api` / `generate:api:check`。对比 generator 配方（`.done-coding/generator/assemble/recipes/`）：后者只能渲染模板碎片，不能消费 OpenAPI 文档。

## 待定

generator 是否提供 OpenAPI 输入的配方类型，或允许登记外部生成器，使其产物进入 manifest 与 tree check。
