---
id: c6xc3c
title: 存量 live spec 清点：4 个 spec 判完工并迁归档
modules: [create, generator, cc-switch]
created: 2026-10-02
source: 池条目 9n3vst
after: ""
---

# PROGRESS — c6xc3c

## 判定口径

逐 spec 对照代码 / 测试 / git 实测判定：已完工 → 补 RETROSPECTIVE + 迁 `.harness` 归档 + 刷两快照；未完工 → 未完部分拆池条目，spec 本身照样归档（过程文档不留公开仓）。

## 进度

- [x] create-cli-noninteractive-env — 完工：`e289cfd`，A1–A3 由 e2e 常驻覆盖；补进业务快照
- [x] gen-modify-marker — 完工：PR #26 `65eab87` 已合 master 并发布；收口遗留（分叉整合 / 配置约定 / utils tsc）均已了结
- [x] create-instances-registry — 完工：R1–R7 在位，单测 7 + e2e；沙盒实跑 ls / prune 正确
- [x] cc-switch-config-single-source — 完工（PR #38 `d433e9c`）；清点发现 2 处文案仍指向废弃 provider.json / model.json，`7ed241e` 修正 + 补断言
- [x] 收口：4 个 spec 补 RETROSPECTIVE 迁归档（.harness `5330898`，项目 `29fb50e`）；新建 cc-switch 模块快照；cc-switch build / 135 测试 / eslint 0

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| 9n3vst 存量 live spec 清点 | 7ed241e · 29fb50e | 4 个 spec 全判完工并归档；cc-switch 两处过期文案修正；`docs/specs/` 清空 |
