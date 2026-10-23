---
id: 7b8nlh
title: lerna ignoreChanges 放行 SKILL.md（发版前）
modules: [cli-skills]
created: 2026-10-22
source: 当轮新建 opjigr
after: ""
---

# PROGRESS — 7b8nlh

## 独占声明

- 根 `lerna.json`（共享骨架）—— 本批次独占至交付。

## 进度

- [x] opjigr — `d8649e9`：`**/*.md` → `**/README.md` + `**/docs/**`；本次 changed 前后一致（9 包）；临时 worktree 实证仅改 SKILL.md 的提交旧配置不判、新配置判出 cli-skills
- [x] 收口：cli-skills 技术快照补发版判定；gov:check 0

## 交付

| 条目 | sha | 结果 |
|---|---|---|
| opjigr lerna ignoreChanges 放行 SKILL.md | d8649e9 | skill 正文改动可触发 cli-skills 发版 |
