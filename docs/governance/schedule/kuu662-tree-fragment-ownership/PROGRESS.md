---
id: kuu662
title: generator tree：碎片分层与产物目录所有权
modules: [generator]
created: 2026-11-07
source: 主协调下发（用户 2026-11-07 授权按部就班推进）
after: ""
---

# generator tree：碎片分层与产物目录所有权

两条均来自 template-hub 模块模板实际消费；改动影响 hub 的 `check:module-templates`，交付前用 `pnpm test:hub` 跑跨仓回归。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| [页面级与模板级碎片分层](gl1ytl-fragment-root-page-template-layering.md) | 未开始 | |
| [tree 产物目录整级所有权与手写文件共存声明](ehzjoy-tree-output-preserve-handwritten.md) | 未开始 | |
| 刷新所涉模块快照与上层摘要；归档本批（只留 PROGRESS.md），`done-coding harness lists` / `check` 通过 | 未开始 | |
| 本批交付归档后立刻、必须、立即开始下一批 `ngco25` | | |

## 边界（整串通用）

- 分支：`feat/generator-tree-ownership`（主协调建），整串提交都在此分支；[MUST NOT] 改动或提交 master；push、合并由用户执行。
- 开工先读根 AGENTS.md、docs/governance/AGENTS.md 与 DEVELOPMENT.md，并逐条核实条目里写的「现状」；与实际不符时以实测为准并在 PROGRESS 记录，不照搬。
- 允许：本机服务、本机数据库与对象存储、联网安装锁定依赖。禁止：付费 API、连接生产或非本机服务、读取或输出 .env 值与凭据、改其他仓（跨仓问题用 `done-coding harness issue` 提）、发布、git worktree、手改锁文件。显式 pathspec 提交。
- 测试按改动范围选择受影响门禁，不固定跑全量（用户口径）；完成声明附命令与退出码。
- 遇真实阻塞（权限、上游未交付、需用户裁决）写本文件「阻塞」并继续不受影响的部分；跨仓前置未满足的批次可先做不依赖部分，或在 PROGRESS 写明等待点后进入下一批。

## 进度

