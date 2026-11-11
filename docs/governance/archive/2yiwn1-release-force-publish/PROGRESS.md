---
id: 2yiwn1
title: 发版准备：16 个公开包一起升版本（README 文档站链接上 npm 页）
modules: [showcase]
created: 2026-11-11
source: 总协调派单（用户 2026-11-11 要求，服务 M4）
after: ""
---

# 发版准备：全部公开包一起升版本

接在批次 9tt22m（README 加文档站链接）之后的发版准备；9tt22m 只在开发分支与发版准备分支上，本批开发分支从 master 切出，故 `after` 留空。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| zcrgzw 本次发版全部公开包一起升版本 | 已完成 | 8c91c89 |
| 登记「下次发版准备时删除 forcePublish」进需求池（thpfmb） | 已完成 | 8c91c89 |
| 归档本批（只留 PROGRESS.md），`gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |

## 边界

- 独占共享骨架 `lerna.json`（只加 `command.version.forcePublish`）。
- 不改 `.github/workflows/`、默认模板源与资产 URL；不 push、不发版。

## 进度

### 方案与理由（2026-11-11）

- 根因：lerna 按「碰到该包目录的提交类型」给每个包定级；`ignoreChanges` 只决定「算不算有变化」，不影响定级。README 在包目录内，单个 `feat` 提交碰到全部 16 个包，强制全发即全部 minor。
- 强制全发：`lerna.json` 的 `command.version` 加 `"forcePublish": true`。CI（`oidc-release.yml`）的 `lerna version` 读该配置，不改工作流；预演实测生效。未选改工作流做按需开关：只有真实发版才能验证，出错会卡住发版。代价是发版后配置随 master 留存，已登记 thpfmb 在下次发版准备时删除。
- 定级：发版分支拆成两个提交——`feat`（原发版准备 9bdae88 的内容）在前、`docs`（README 文档站链接 + showcase 导出剔除 + 本批治理与 lerna 配置）在后。只碰 README 的包只有 docs 提交 → patch；有实际改动的包仍由 feat 提交定 minor；只被依赖带动的包回到 patch。

### 破例记录

AGENTS.md「发布」规定待发布改动以 origin/master 为基压缩为一次提交（用户 2026-11-07 口径）。单个提交无法同时满足「只改 README 的包按 patch 升」，本次改为两个提交；**用户 2026-11-11 在总协调会话明确同意此次破例**（经总协调转达）。仅限本次发版，规则本身不改。

### 版本对照（lerna 预演）

| 包 | 当前 | 新版本 | 级别 | 原因 |
| --- | --- | --- | --- | --- |
| @done-coding/cli-generator | 0.4.0 | 0.5.0 | minor | feat：lodash.template 钉版本、prettier 就近解析等 |
| create-done-coding | 0.19.0 | 0.20.0 | minor | feat：默认远端分支、template.lock |
| @done-coding/cli-skills | 0.7.0 | 0.8.0 | minor | feat 提交改了 skill 文档 |
| done-coding | 0.24.0 | 0.24.1 | patch | 依赖带动 + README |
| @done-coding/cli-component | 0.7.0 | 0.7.1 | patch | 依赖带动 + README |
| @done-coding/cli-dex | 0.3.0 | 0.3.1 | patch | 依赖带动 + README |
| @done-coding/cli-mcp | 0.7.0 | 0.7.1 | patch | 依赖带动 + README |
| @done-coding/cli-cc-switch | 0.6.0 | 0.6.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-config | 0.3.0 | 0.3.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-extract | 0.3.0 | 0.3.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-git | 0.8.0 | 0.8.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-harness | 0.4.0 | 0.4.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-inject | 0.7.0 | 0.7.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-publish | 0.9.0 | 0.9.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-template | 0.13.0 | 0.13.1 | patch | 只改 README（强制全发） |
| @done-coding/cli-utils | 0.14.0 | 0.14.1 | patch | 只改 README（强制全发） |

预演方法：本仓克隆到临时目录，以 origin/master c7908e5 为基按上述两个提交重放（树与发版分支相同），跑 `lerna version --yes --no-push --no-git-tag-version`；`forcePublish` 分别经命令行参数与 `lerna.json` 配置各测一次，均列出 16 个包。

对照组（同一克隆实测）：原 9bdae88 不强制发 7 个包，级别与上表前 7 行一致；65396d4（单个 feat 提交）不强制同样 7 个包，但 done-coding / component / dex / mcp 被抬成 minor；65396d4 强制全发则 16 个包全部 minor。
