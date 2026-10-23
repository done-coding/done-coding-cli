---
id: zt5vpi
title: codegen-unified 合入 + 跨仓回归闸 + generator R4 + create 完成提示
modules: [generator, mcp, create]
created: 2026-10-02
source: 池条目 cfhiub / wpxxgb + 当轮新建 5gg5or / 25oq1f
after: ""
---

# PROGRESS — zt5vpi

## 独占声明

- 根 `package.json`（新增回归 scripts）、`pnpm-lock.yaml`（若合入带依赖变更）—— 本批次独占至交付。

## 顺序

ⓐ `5gg5or` 合入 codegen-unified → ⓑ `25oq1f` 回归闸（ⓐ 的 T10 回归即用它跑）→ ⓒ `cfhiub` R4（在合入后的 assemble 上改）→ ⓓ `wpxxgb` create 完成提示 → 收口（串末：收工）。

## 进度

- [x] 5gg5or — 合入 `3dced39` 零冲突；10 包 655 测试绿、build 18 包过；tasks 补正 + RETROSPECTIVE `6c63d93`；spec 迁归档（.harness `b43f08b`）+ 两快照 `9430b91`
- [x] 25oq1f — `211a18c`：`pnpm test` 聚合 + `pnpm test:hub`；真 hub 22 配方零漂移退 0 / 篡改副本退 1 / 缺 hub 退 2
- [x] cfhiub — `f9034dc`：addFragment 目录源计划期逐文件声明效果；hub 去规避后 0.2.0 退 1（C5）→ 本版退 0 且零漂移
- [x] wpxxgb — `b88901a`：template.json `usageSteps` 覆盖完成提示，complete 返回带 usageSteps；e2e 三例
- [x] 收口：模块快照 generator / create / mcp 新建 + MODULES / SNAPSHOT；build 18 包、`pnpm test` 10 包 664 例、三包 eslint 0、`test:hub` 0

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| 5gg5or codegen-unified 合入 | 3dced39 · 6c63d93 · 9430b91 | 合入零冲突；T1–T10 完成（T6/T9 仓外验证）；655 测试绿；遗留转池 ehzjoy / gl1ytl |
| 25oq1f 回归入口 | 211a18c | 根聚合单测 + hub 语料跨仓回归，三态退出码实测 |
| cfhiub generator R4 目录铺开 delete | f9034dc | 计划期逐文件效果；generator 393 例绿 |
| wpxxgb create 完成提示写死 pnpm | b88901a | 模板声明 usageSteps；hub 模板需自行声明（hub 侧动作） |
