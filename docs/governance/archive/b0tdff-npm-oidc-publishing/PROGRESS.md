---
id: b0tdff
title: Lerna 9 与 npm OIDC 单入口发布迁移
modules: [utils, cli-skills]
created: 2026-11-04
source: 用户本会话明确要求，对齐 done-coding-request 已跑通的发布 CI
after: ""
---

# npm OIDC 发布迁移进度

> 文档定位：记录 · 仅覆盖发布 CI 升级、npm 信任配置与验证，不扩展 CI 功能。

## 目标与边界

在 chore/npm-oidc-publishing 分支实施，把 release-publish.yml、prerelease-publish.yml 合并为单入口 oidc-release.yml（内容与 done-coding-request 云端已验证版本一致）。只保留三类改动：Lerna 升级到 9.0.7（publish 拆为 version 与 from-package）、npm token 切 OIDC（id-token: write、npm 11.21.1、移除 NPM_TOKEN 注入）、双工作流合并。不增加重跑恢复、渠道检查或发布验收。

共享骨架独占：根 package.json、pnpm-lock.yaml、.github/workflows/oidc-release.yml。

cli-skills 的 repository 由 gitee 改为 GitHub，否则 provenance 校验不通过。本地 `pnpm push`（lerna publish）不在本批范围。

push、合并 MR 由用户操作；用户已确认本批按 alpha 后正式的顺序发布。

## 可信发布者

16 个可发布包 按 oidc-release.yml 各登记一条。npm 登记后约 48 小时内须发布一次才生效，所以本批在 cli-utils（其余 15 包都依赖它） 入口各加一行注释，让全部可发布包至少发一次。

## 实施阶段进度（历史记录，最终状态以下文为准）

- 已完成：工作流替换、Lerna 与锁文件更新；锁文件直接依赖除 Lerna 外版本未变。
  包预发与正式均通过，依赖与分支同步符合预期；构建与现有单测通过。第 1～5 步与真实 OIDC 未在本地覆盖。
- 未完成：登记可信发布者、push、云端 alpha 与正式发布验收、快照刷新与批次归档。

## 最终结果（2026-11-05）

- 本批已完成合并与发布：PR #56，合并提交 `060cfc5`，发布交付提交 `cbec4c9`。本轮 git 回读确认 HEAD、origin/master、origin/prerelease、origin/release 均指向 `cbec4c9`；最初的本地实施分支描述仅记录过程，不代表当前待合并状态。
- 当前发布入口为 `.github/workflows/oidc-release.yml`，Lerna version 与 publish from-package 分步执行，npm 发布采用 OIDC。
- npm / git 回读（2026-11-05）：本次发布 16 个包，全部有 provenance；各包版本以 `cbec4c9` 的 tag 为准，例如 done-coding 0.23.4、@done-coding/cli-harness 0.3.1、@done-coding/cli-utils 0.13.1、create-done-coding 0.18.1。本轮本地 git 回读核对了全部发布 tag。
- 已在空目录从 npm 安装 done-coding@0.23.4、@done-coding/cli-harness@0.3.1，--version 输出正确。CI 日志未直接查看，不据此宣称 CI 各步骤均经日志验收。
- 早期“未完成”的可信发布者登记、push 与正式发布等待状态已被上述发布结果取代，不再作为待办；本轮只做文档收口，不发版。
- 本轮刷新相关快照与指令中的过期发布事实，保留历史过程和仍有效的验证限制；无未完成需求正文需要回池。按规则归档时只保留本文件。

## 收口检查（2026-11-05）

dc-harness lists、gov:check（node packages/harness/es/cli.mjs check）、dc-harness instructions 通过。本批只改文档，未重跑构建和测试。
