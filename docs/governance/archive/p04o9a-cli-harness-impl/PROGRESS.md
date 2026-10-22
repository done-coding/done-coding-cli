---
id: p04o9a
title: cli-harness 实现（lists / check / issue + skill + DC 挂载）
created: 2026-09-28
---

# PROGRESS — p04o9a cli-harness 实现

## 独占声明

- `packages/cli`（挂载 `DC harness`）、根 `package.json`（`gov:*` scripts）、`pnpm-lock.yaml`（CI 同版本 pnpm 10.33.0 重生成，仅新增 harness importer 行）—— 本批次独占至交付。

## 进度

- [x] lists：TS 移植，本仓 / template-hub / `~/.claude` 三处在库清单逐字节一致
- [x] check：元闸 + 并行闸 + 收口形态 + 清单零 diff；领域表来源走 `.done-coding/harness/governance/config.json`（hub 副本配置后与其 gates.py 结论一致）
- [x] issue：临时 git 仓端到端，目标仓提交仅含 issue 文件 + ISSUE.md
- [x] 本仓 gates.py 退役 → `pnpm gov:lists` / `pnpm gov:check`
- [x] cli-skills 增 cli-harness skill；`DC harness` 挂载
- [x] 模块快照 + 上层 SNAPSHOT + 根两快照 + 归档 + 清单 + 闸

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| o07db5 新增 @done-coding/cli-harness | ab5b0bd | lists / check / issue 实现 + DC 挂载 + skill；harness 16 · cli-skills 7 测试绿、eslint 0、build ✓；scope 拆出为 backlog `qdoeql` |
