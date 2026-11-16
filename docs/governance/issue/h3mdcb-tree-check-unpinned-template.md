---
id: h3mdcb
title: generator tree check 比对的模块模板没有版本锁定，分不清手改与模板更新
created: 2026-11-16
from: done-creating-analysis
---

## 现象

`done-coding generator tree check --all`（本机 done-coding 0.24.0）比对的是「此刻能找到的模块模板」重新生成的结果，而模板根没有版本锁定：仓内没有 `.done-coding/templates/` 时，取全局 `~/.done-coding/templates/<名>`，本机它是指向 template-hub **工作区** `module-templates/<名>` 的软链。于是：

- 同一提交在两台机器（或同一台机器 template-hub 切到不同提交 / 有未提交改动时）tree check 结果可以不同；
- template-hub 发了新模板后，项目 tree check 直接报漂移，看不出是「项目手改了生成物」还是「模板变了」；
- 项目的 manifest 不记录生成时用的模板版本，事后无法复现当时的生成结果。

（相关：template-hub `module-templates/rules/README.md` 写了「有仓内 `.done-coding/templates/` 时 tree check 比的是仓里副本，发现不了模板中心的新版本」——两种取法一个发现不了新版本，一个分不清漂移来源。）

## 复现

1. 项目仓里不放 `.done-coding/templates/`，`~/.done-coding/templates/forge` 软链到 template-hub 工作区。
2. 项目 `tree build --all` 后提交，`tree check --all` 无漂移。
3. 在 template-hub 工作区改一个 forge 碎片（不提交）。
4. 项目里再跑 `tree check --all`：报漂移，而项目没有任何改动。

## 期望

- manifest 记录生成时的模板来源与版本（如 template-hub 提交号或包版本、碎片内容哈希）；
- `tree check` 默认按 manifest 记录的版本比对（区分「生成物被手改」与「模板有新版本」两类结果），另给一个显式选项比对当前模板以发现可升级项。

发现于 done-creating-analysis 批次 62pgut（readings-admin 收拢到 done-coding）。
