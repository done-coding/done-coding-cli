---
id: 5pmb5g
title: dc-harness 三闸：未跟踪的新文件不被检查（恒绿）；另有方向、__all__、骨架 public 分测试、读数口径、测试归位五点
created: 2026-11-16
from: business-chat-studio
---

business-chat-studio 按 blueprint 0044 做后端领域公开入口试点（批次 icqo79、n9015i）时，用分支 `feat/harness-mechanical-gates`（67f1016，取 49cd746 的 `packages/harness` 本机构建）的归属 / 引用 / 缺口表三闸，发现以下问题。按严重程度排。完整处理表与探针输出见该仓 `docs/governance/records/n9015i-backend-public-entries.md`。

## ⓐ 未跟踪的新文件不被检查，三闸在新文件上恒绿

现象：三闸只取 `git ls-files` 的跟踪文件。新建但还没 `git add` 的代码文件，既不算无主，也不查它的引用和接缝标注。改代码时最常见的状态恰好是「新文件未暂存」，所以 `check` 在最需要拦的时候是绿的。
复现：在已配 `gates.ownership/imports: on` 的仓里新建 `backend/services/<svc>/probe.py`（不在任何 paths 里），内容写一行越界引用 `from app.services.<领域>.<私有子模块> import X`。跑 `dc-harness check`，结果全过。`git add -N probe.py` 后再跑，报「无主」和「引用」。
实例：chat 试点新建 6 个测试文件，`git add -N` 之前 `check` 全过，其实一个都没查到。
期望：并入 `git ls-files --others --exclude-standard`。至少要输出「有 N 个未跟踪代码文件未纳入检查」，不要静默通过。

## ⓑ public 只管可见性，不管依赖方向，经公开入口的环照样通过

现象：引用闸只回答「目标是否落在 public 内」。两个领域互相经对方的公开入口引用时，形成的环查不出来。
复现：chat 试点前，conversation 路由引 answer-feedback 服务入口，answer-feedback 服务入口又引 conversation 服务入口。两处都登记为 public 后，引用闸全过。本仓只好另用 import-linter `forbidden` 合约守方向。
期望：领域表可选 `depends` 列（或「不得依赖」列），引用闸据此报反向边或环。

## ⓒ 公开粒度是文件，Python `__all__` / TS 导出列表不参与判定

现象：Python 门面 `services/<领域>/__init__.py` 登记为 public 后，凡是 import 进这个文件的名字（包括没写进 `__all__` 的私有类型），外部都能取到，闸不报。
复现：领域 A 写 `from app.services.<B> import 某私有类`，这个类被 B 的 `__init__.py` 导入但不在 `__all__` 里。结果引用闸通过。
期望：可选规则「跨归属的 `from X import name` 须在 X 的 `__all__` 内」；TS 侧对应 `export` 列表。

## ⓓ 骨架行的 public 不区分源码与测试

现象：领域测试需要装配句柄（如 `Runtime` 类型、`machine_ticket`）。给「服务装配」骨架行开 public，领域源码也就能反向依赖装配；不开，领域测试只能经骨架测试的公开件转出。本仓用 `tests/support.py` 和 `DbApp` 别名绕过。
复现：骨架表 `studio 服务装配` 行 public 留空，`tests/domains/<领域>/test_x.py` 写 `from app.services.runtime import Runtime`。结果报「领域引共享骨架内部文件」。
期望：骨架行可声明「只对测试路径开放」的 public，或按引用方是否落在测试路径区分判定。

## ⓔ 读数口径：违规按「引用行 → 目标文件」逐条计，一行引多个领域记多条

现象：同一仓内，「收之前违规条数」随口径变化很大：chat 实测 76，总协调模拟约 52。0044 的退役判据「判为应公开远多于改走公开入口」按行数会误触发，因为一个入口文件被引很多次。chat 的 52 行「应公开」只落在 13 个入口文件上。
期望：`check` / `owners` 能按目标文件汇总违规（例如加 `--by-target`），或在输出末尾给出「涉及目标文件 N 个」。

## ⓕ 处理方式不止二选一：测试归入被测领域

现象：0044 ⓓ 要求每条违规二选一：「改走公开入口」或「判为应公开」。但服务根测试只测一个领域内部时，正确做法是把测试移进该领域并登记进它的 paths（0044 未定事项也说测试引本领域内部不受约束）。chat 有 15 条是这样处理的。工具文档和 cli-harness skill 没提这种处理。
期望：README 与 skill 的引用闸一节写明第三种处理，并给出领域测试目录登记的例子（如 `backend/services/<svc>/tests/domains/<领域>/`）。
