---
id: nyo36w
title: 2026-10-23 发版收口（cli-harness 首发 + 统一代码生成 + skill 多宿主 + 退役 ai / mrm）
modules: [harness, generator, create, mcp, cli-skills, cc-switch, dex]
created: 2026-10-23
source: 池条目 7htubs
after: ""
---

# PROGRESS — nyo36w

## 进度

- [x] 合入：`feat/harness-codegen-skills`（78 提交经用户确认压为 `ef6f993`，原历史在本地备份分支 `backup/harness-codegen-skills-pre-squash`）经 PR #44 合入 master（`03742b7`）。
- [x] 发布：CI `release-publish.yml` 发布提交 `dd56f75`；npm latest 实测 9 包——cli-harness 0.1.0（首发）· done-coding 0.22.0（BREAKING：移除 `DC ai` / `DC mrm`）· cli-skills 0.3.0 · create-done-coding 0.17.0 · cli-generator 0.3.0 · cli-mcp 0.6.0 · cli-cc-switch 0.4.0 · cli-dex 0.2.0 · cli-component 0.6.3；alpha 同步发出。首轮误合 prerelease 时 E404 / E503 失败未发出任何版本，用户修正 token 后重发成功。
- [→] npm deprecate cli-ai / cli-mrm —— 需用户 npm 凭据，拆出回池 `bjpfyu`。
- [x] 发布后通知（走拉取、不建回执）：template-hub issue `vfohs8`（hub `439685c`：一键登记模板清单、治理闸切 dc-harness、模板产出 AGENTS.md + 兼容 CLAUDE.md；其既有 `sknjzo` / `anq8ng` / `0k9idl` 前置已满足）；插件仓 issue `b8zi11`（`65fa53d`：改名 done-coding-agent-plugins、双宿主清单、方法类 skill 待定）。附：hub 清单自 10-21 py 改格式起即漂移（BACKLOG / ARCHIVE-DONE），非本次引入，随 `vfohs8` ⓑ 处理。
- [x] 收口：harness / generator / create / mcp / cc-switch 模块快照版本行刷新；根业务快照 harness 行更正；gov:check 0。

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| 7htubs 发版 | 03742b7 · dd56f75 | 9 包发布；deprecate 拆出 `bjpfyu` |
