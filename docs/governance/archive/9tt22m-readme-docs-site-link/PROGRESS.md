---
id: 9tt22m
title: 根与各包 README 引导到文档站，站点导出剔除该行
modules: [showcase]
created: 2026-11-10
source: 总协调派单（用户 2026-11-10 要求；随本次发版带出）
after: zsz54k
---

# README 引导到文档站

根 README 与 16 个发布包 README 各加一行指向 `https://done-coding.github.io/cli/` 对应页；该行用固定标记包住，showcase 导出按标记剔除，避免站点页自指。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| vmz2zy 根与各包 README 加文档站链接 | 已完成 | 6c4bf3e |
| 刷新所涉模块快照与上层摘要；归档本批（只留 PROGRESS.md），`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 串末，收工 | | |

## 边界

同 `0cja0o`「边界（整串通用）」；另：不改默认模板源与 cli 默认资产 URL，只动 README 与 `apps/showcase`。

## 进度

### 设计（2026-11-10，总协调裁定）

- 标记：`<!-- docs-site-link -->` 与 `<!-- /docs-site-link -->` 各占一行，中间一行 `完整文档：[使用文档](<URL>)。`；放在标题与简介之后、首个二级标题之前。
- 链接：根 README 指 `https://done-coding.github.io/cli/`，包 README 指 `https://done-coding.github.io/cli/docs/packages/<包目录名>`（站点 `apps/cli-site` base `/cli/`，分包页按包目录名导出）。
- 导出：`apps/showcase/export.mjs` 在改写链接前按标记剔除整段（含标记行），代码围栏内不处理；标记不成对即报错，不按文本内容猜。

### 实现记录

- 17 份 README（根 + 16 个发布包）在首个二级标题前加引导段；harness README 原有未按 prettier 排版的表格与代码块，只插入段落、不顺带重排。
- `apps/showcase/export.mjs` 新增 `stripDocsSiteLink`，在链接改写前按标记剔除整段，段前后皆空行时连带去掉段后空行；围栏内的标记原样保留；未闭合、缺开始、嵌套均报错且不改现有产物。
- 本批由 Claude 直接实现（未经 Codex）：开工时本机另有会话的 Codex 任务在跑，按「本机重任务约束」一次一个重任务；本批改动小。
- 验证：showcase vitest 2 文件 55 例全过（新增剔除、只认标记、三种标记错误）、eslint 退 0；真实仓本地导出 17 篇，与加段前 HEAD 的 README 导出 18 个文件逐字节一致；README 中 17 个链接实测均 200。未覆盖：组织站重建与线上页面。
