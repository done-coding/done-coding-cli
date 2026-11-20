---
id: 5pmb5g
title: dc-harness 三闸：未跟踪的新文件不被检查（恒绿）；另有方向、__all__、骨架 public 分测试、读数口径、测试归位五点
created: 2026-11-16
from: business-chat-studio
---

business-chat-studio 按 blueprint 0044 做后端领域公开入口试点（批次 icqo79、n9015i）时，用分支 `feat/harness-mechanical-gates`（67f1016，取 49cd746 的 `packages/harness` 本机构建）的归属 / 引用 / 缺口表三闸，发现以下问题。按严重程度排。完整处理表与探针输出见该仓 `docs/governance/records/n9015i-backend-public-entries.md`。

> 分诊记录（2026-11-17，总协调转达用户规矩）：ⓐⓕ 拆为 `sab3rz`、ⓒ 拆为 `skdlm9`、ⓓ 并入 `rhfv9v`，均进批次 `0kmyf7`；本条只留 ⓑⓔ（新功能各 2 次，未满三次留收件箱）。

## ⓑ public 只管可见性，不管依赖方向，经公开入口的环照样通过

现象：引用闸只回答「目标是否落在 public 内」。两个领域互相经对方的公开入口引用时，形成的环查不出来。
复现：chat 试点前，conversation 路由引 answer-feedback 服务入口，answer-feedback 服务入口又引 conversation 服务入口。两处都登记为 public 后，引用闸全过。本仓只好另用 import-linter `forbidden` 合约守方向。
期望：领域表可选 `depends` 列（或「不得依赖」列），引用闸据此报反向边或环。

## ⓔ 读数口径：违规按「引用行 → 目标文件」逐条计，一行引多个领域记多条

现象：同一仓内，「收之前违规条数」随口径变化很大：chat 实测 76，总协调模拟约 52。0044 的退役判据「判为应公开远多于改走公开入口」按行数会误触发，因为一个入口文件被引很多次。chat 的 52 行「应公开」只落在 13 个入口文件上。
期望：`check` / `owners` 能按目标文件汇总违规（例如加 `--by-target`），或在输出末尾给出「涉及目标文件 N 个」。
