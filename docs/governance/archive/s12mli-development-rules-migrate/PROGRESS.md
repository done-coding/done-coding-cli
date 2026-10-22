---
id: s12mli
title: 开发模式迁移到 DEVELOPMENT.md（harness-workspace 新版）
modules: [harness]
created: 2026-10-22
source: 当轮新建 6wq82d（用户 2026-10-22 要求迁移）
after: ""
---

# PROGRESS — s12mli

## 独占声明

- 根 `CLAUDE.md` / 新建根 `AGENTS.md` / `docs/governance/{CLAUDE,AGENTS,DEVELOPMENT,README}.md` —— 本批次独占至交付。

## 进度

- [x] 6wq82d — `ccd0a1b`：DEVELOPMENT.md（模板 + 本仓专属增量）、根 AGENTS.md 短入口、根 CLAUDE.md 移除开发模式段与过期「在途程序」段并更正发布条、治理目录 CLAUDE.md → AGENTS.md（仅维护治理文件时适用）、总纲职责表同步；临时标记只读实测 Claude / Codex × 仓根 / packages/create 4/4 通过
- [x] 收口：本批只改治理文档形态，无领域代码改动，模块快照无需变更；gov:check 0
- [x] 向 dotfiles 收件箱提 issue `8dzknw`（dotfiles `f35575e`）：开发模式改为按需读取后，上下文压缩后规则可能丢失

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| 6wq82d 开发模式迁移 | ccd0a1b | 两工具从仓根与子目录均读到 DEVELOPMENT.md |
