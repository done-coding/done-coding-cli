---
id: i5t6hl
title: dc-harness check 有闸失败时不再列出通过的闸，分不清「通过」与「没跑」
created: 2026-11-16
from: business-novel-studio
---

business-novel-studio 按 blueprint 0044 收后端领域公开入口（批次串 vmp19e → v6nft8）时，用分支 `feat/harness-mechanical-gates` 49cd746 的 `packages/harness` 本机构建（0.4.1）跑 `check`，发现失败时的输出缺一块。同串遇到的其余问题与 5pmb5g（未跟踪文件、`__all__`、骨架 public 分测试）、rhfv9v（public 不分使用方）同题，只引用不重投。

## 现象

只要有一项闸失败，`check` 就只打 `❌` 行，不再打「✅ … 全过」那一行，也不列哪些闸执行过且通过。读输出的人分不清「归属闸通过了」和「归属闸没跑」。

## 复现

1. 仓里配 `gates: { ownership: "on", imports: "on", seams: "on" }`，三闸都有数据且都通过，`check` 打出 `✅ 元闸 / 并行闸 / 收口形态 / 清单 / 归属闸 / 引用闸 / 缺口表闸 全过`。
2. 只制造一条引用违规（领域源码加一行 `from app.main import create_app`），再跑 `check`。
3. 输出只有那一条 `❌ 引用：…`，退出码 1；没有任何一行说明归属闸、缺口表闸、元闸、清单是否执行、是否通过。

收之前取基线时更明显：引用闸 68 条违规，同时归属闸刚对齐到 0，但输出里看不到「归属闸通过」，只能另跑 `owners` 间接确认。

## 期望

失败时也列出执行过且通过的闸，例如末尾一行 `✅ 通过：元闸 / 并行闸 / 收口形态 / 清单 / 归属闸 / 缺口表闸`，再加 `❌ 未通过：引用闸（68）`。各闸违规条数一并给出，便于记「收之前 / 收之后」读数。
