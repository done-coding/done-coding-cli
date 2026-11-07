---
dropped: 本机环境问题：lodash.template 4.18.0（2026-03-31 发布）有缺陷，次日 4.18.1 修复且为 latest；全新安装按 ^4.5.0 解析到 4.18.1。本机 pnpm 全局目录的锁沿用了当时解析到的 4.18.0，才复现报错
dropped_at: 2026-11-07
id: sd8tt8
title: 已发布 generator 解析到 lodash.template 4.18.0，渲染时报 assignWith is not defined
modules: [generator]
created: 2026-11-07
parent: ""
---

## 现象

`@done-coding/cli-generator` 0.3.0 / 0.3.1 的 `lodash.template` 范围是 `^4.5.0`（`packages/generator/package.json`），新装时解析到 4.18.0，渲染模板抛 `ReferenceError: assignWith is not defined`。

## 复现

在空目录 `npm i @done-coding/cli-generator@0.3.1`（或 pnpm 等价），用 template-hub 的 `scripts/forge-app-check/check.mjs` 以该生成器生成实例即报错。2026-11-06 主协调在 template-hub 复核时撞上；以 pnpm-workspace.yaml `overrides: lodash.template: 4.18.1` 规避后检查全 0（注意 package.json 的 `pnpm.overrides` 在 pnpm 12 下不生效）。

## 期望

generator 锁定可用版本范围（如排除 4.18.0 或改用不依赖该包的渲染实现），发版后全新安装可正常渲染；补一条用全新安装的产物跑渲染的回归验证。
