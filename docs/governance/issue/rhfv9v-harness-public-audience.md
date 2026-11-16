---
id: rhfv9v
title: dc-harness 引用闸：领域 public 不分使用方，给装配的入口（路由与默认实现）别的领域也能引
created: 2026-11-16
from: business-strategy-studio
---

business-strategy-studio 按 blueprint 0044 收后端领域公开入口（批次 hulu6z、k1tykh）时，用分支 `feat/harness-mechanical-gates`（49cd746 的 `packages/harness` 本机构建）的三闸，发现一处 5pmb5g 没有覆盖的问题。5pmb5g 的 ⓐ（未跟踪新文件恒绿）、ⓑ（方向）、ⓒ（`__all__`）、ⓔ（读数口径）、ⓕ（测试归位）本仓同样遇到，只引用不重复。

## 现象：领域 `public` 不分使用方，给装配的入口别的领域也能引

本仓每个领域是一个纵向包（`src/app/<领域>/`），领域之间的入口是 `public.py`（动作、DTO、端口）。服务装配（`main.py`）还要拿路由与默认实现（本地执行器、内存仓储、翻译器），而这些实现本身依赖 `public.py`，放进 `public.py` 会循环导入。所以每个领域另设装配入口 `assembly.py`，只给装配与服务根测试用。

两个文件都要登记在领域 `public` 列，引用闸才放行装配。但这样一来，别的领域引 `assembly.py`（拿到执行器、仓储这类实现）引用闸也放行。本仓靠 import-linter 的 `forbidden` 合约（每个领域只许经对方 `.public`）拦住，探针已证。

5pmb5g ⓓ 说的是骨架行 public 要分「源码 / 测试」；这里是领域行 public 要分「装配 / 别的领域」，同一类需求的另一面。

## 复现

1. 领域表 `campaign-play` 的 public 写 `src/app/campaign_play/public.py`、`src/app/campaign_play/assembly.py`。
2. 在 `src/app/military_command/public.py` 写 `from app.campaign_play.assembly import LocalRuleExecutor`。
3. `dc-harness check`：引用闸通过（import-linter 报 `military_command 只走 campaign_play.public BROKEN`）。

## 期望

`public` 条目可选标注使用方，例如 `assembly:` 前缀表示只对共享骨架（装配、服务测试）开放、对其他领域关闭；或领域表加一列「装配入口」，引用闸对领域来源只认 `public`、对骨架来源两列都认。

本仓记录：`docs/governance/records/k1tykh-backend-public-entries.md`（business-strategy-studio）。
