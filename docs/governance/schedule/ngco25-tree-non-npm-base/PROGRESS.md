---
id: ngco25
title: tree 基座版本闸支持非 npm 基座
modules: [generator]
created: 2026-11-07
source: 主协调下发（用户 2026-11-07 授权按部就班推进）
after: "kuu662"
---

# tree 基座版本闸支持非 npm 基座

0.4.0 对找不到的基座只告警（3r4dvv）。本批给非 npm 基座（Python fastapi 等）一种显式声明与校验方式，不让「找不到就放行」成为默认。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| [非 npm 基座版本闸](dhokbr-tree-non-npm-base-version.md)：声明方式与 hub 对齐（必要时给 hub 提 issue），未声明校验方式的非 npm 基座给出明确提示 | 未开始 | |
| 刷新所涉模块快照与上层摘要；归档本批（只留 PROGRESS.md），`done-coding harness lists` / `check` 通过 | 未开始 | |
| 串末：报告各批交付 sha、验证结果与未完成项（压缩由用户另行指示，本串不做） | 未开始 | |
| 收工 | | |

边界同串首 `kuu662`。

## 进度

