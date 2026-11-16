---
id: d3f6t7
title: pnpm 12 全新安装 done-coding 仍因依赖安装脚本被拦退出码 1
modules: [dex]
created: 2026-11-11
parent: ""
---

## 现象

pnpm 12.15.0 全新安装 done-coding（本地打包的 0.24.1，cli-utils 已换 pinyin@4，见批次 an1hhe）退出码 1，`ERR_PNPM_IGNORED_BUILDS` 列出三项：

- `done-coding` 自身：`packages/cli` 的 `postinstall`（`scripts/postinstall.mjs`，作为依赖安装时打印使用提示）。
- `@google/genai@1.52.0`：`preinstall` 只是 `echo 'preinstall: no-op'`。
- `protobufjs@7.6.6`：`postinstall`。

后两项链路：done-coding → cli-dex → `@earendil-works/pi-coding-agent@0.84.1` → pi-ai → `@google/genai` → protobufjs。cli-generator、create-done-coding 单独安装已退出码 0。

## 影响

消费方在 CI / 脚本里用 pnpm 12 全新安装 done-coding 会被判失败，需自行配置 `onlyBuiltDependencies` 或 approve-builds。

## 待定

- done-coding 自身 postinstall 是否保留（去掉则安装后不再打印提示；`packages/cli` 属共享骨架，需声明独占）。
- 第三方链路无法在本仓消除脚本：可选做法有 cli-dex 改为按需安装、不随 done-coding 打包，或在文档写明 pnpm 12 需要放行的包。需用户取舍。
