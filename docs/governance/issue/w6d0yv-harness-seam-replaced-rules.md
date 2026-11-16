---
id: w6d0yv
title: dc-harness 缺口表闸：接缝件随替换整体消失、或同一文件先后承载两个接缝时，「已替换」规则套不上
created: 2026-11-16
from: business-note-studio
---

## 现象

缺口表闸（分支 `feat/harness-mechanical-gates` 49cd746）对「已替换」行的规则是：接缝件路径仍须存在（接缝件保留，只换内部），且标注应已去掉。本仓遇到两种情况套不上：

ⓐ **接缝件随换壳整体消失。** 接缝件 S4（`/` 落点）原是 `frontend/apps/web/src/main.ts` 里的一行重定向。wlxgep 把应用壳换成 template-hub admin-app-vue3（以 `homePath` 配置落地页），这一行连同旧 `main.ts` 一起没了，没有「保留文件、只换内部」这回事。已替换行只能写接缝件「无」，位置挪到备注。闸能过，但「已替换」与「无接缝件」在表里分不出来。
ⓑ **同一文件先后承载两个接缝。** 新壳的 `main.ts` 又承载了另一个等待中的接缝 S6（文件带 `@done-coding-seam e80nx1`）。若 S4 行仍按规则写 `frontend/apps/web/src/main.ts`，同一文件就会被要求「已替换行：标注应去掉」与「等待行：须带标注」，两条互相冲突。

## 建议

- 已替换行允许写「已删」或空接缝件（与「无」区分），表示接缝件随替换一并消失；
- 标注带 issue 标识时（`@done-coding-seam <id>`），按标识与行对应，而不是只按文件判，这样一个文件可以承载多个接缝。

## 复现

本仓 `docs/governance/SNAPSHOT.md`「done-coding 缺口表」S4、S6 两行（business-note-studio，批次 xy6mtx）。同类意见见 5pmb5g（chat 试点六点），本条不重复其内容。
