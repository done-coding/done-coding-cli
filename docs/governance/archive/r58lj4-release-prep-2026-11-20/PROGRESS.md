---
id: r58lj4
title: 发版准备：合并 create 链接越界修复与收件箱两批，删除 forcePublish
modules: [showcase]
created: 2026-11-20
source: 用户 2026-11-20 要求把待发版分支合到一个分支并以 origin/master 为基压缩为一次提交
after: ""
---

# 发版准备：合并待发版分支，删除 forcePublish

## 任务

| 项                                                                                                                                                                                  | 状态   | 交付 sha         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- |
| 合并 `fix/create-stale-origin-head`（g4p7sa / ynfow5 与后续越界修复）与 `feat/cli-inbox-2026-11-17`（0kmyf7 / avrgue），治理清单冲突用 `gov:lists` 重生成、`SNAPSHOT.md` 两侧行合并 | 已完成 | 发版准备压缩提交 |
| thpfmb 删除 `lerna.json` 的 `command.version.forcePublish`；`lerna changed` 预演列出 10 个包（6 个有改动 + 4 个依赖方），不再全量 16 个                                             | 已完成 | 发版准备压缩提交 |
| 归档本批（只留 PROGRESS.md），`gov:lists` / `gov:check` 通过                                                                                                                        | 已完成 | 发版准备压缩提交 |

## 边界

- 压缩前分支备份为 `backup/create-stale-origin-head-pre-squash`、`backup/cli-inbox-2026-11-17-pre-squash`。
- 不改 `.github/workflows/`；不 push、不发版，push 与发版需用户另行明文授权。
