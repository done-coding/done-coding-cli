# 外部反馈收件箱（ISSUE）

> 文档定位：快照型清单 · **[MUST] 由 `scripts/governance-lists.py` 重生成，[MUST NOT] 手工维护**
> 正文在 `issue/<id>-<slug>.md`；其中条目只有一个状态：**未分诊**。
> 分诊 [MUST] 由用户触发，三个出口全部 `git mv`：`schedule/<批次>/`（当轮就做）· `backlog/`（成立但不是现在）· `dropped/`（不成立 / 已修 / 重复）。
> **issue 是报告不是派单**：外部方无回执可期、无进度可问，处置权在本仓。
> 按登记日升序——**最上面的就是积压最久的**。

共 **12** 条待分诊。

| id | 标题 | 来源 | 登记 | 文件 |
|---|---|---|---|---|
| `cjunp5` | generator 配方 format 是否支持 "ruff"（Python 产物生成后格式化） | done-coding-template-hub | 2026-11-12 | [cjunp5-generator-format-ruff.md](issue/cjunp5-generator-format-ruff.md) |
| `fxybmi` | 全局 done-coding 0.23.3 的 generator tree 渲染碎片时报 assignWith i | done-coding-template-hub | 2026-11-13 | [fxybmi-generator-tree-assignwith.md](issue/fxybmi-generator-tree-assignwith.md) |
| `o167op` | generator tree build 拒写时打出整段调用栈，且提示的 --force-clean 与 --hel | done-coding-template-hub | 2026-11-13 | [o167op-tree-build-refuse-output.md](issue/o167op-tree-build-refuse-output.md) |
| `5pmb5g` | dc-harness 三闸：未跟踪的新文件不被检查（恒绿）；另有方向、__all__、骨架 public 分测试、读 | business-chat-studio | 2026-11-16 | [5pmb5g-harness-gates-pilot-feedback.md](issue/5pmb5g-harness-gates-pilot-feedback.md) |
| `7m924q` | dc-harness 引用闸：Vue 文件里与 <script> 同一行的 import 不被识别，越界引用漏报 | business-code-studio | 2026-11-16 | [7m924q-harness-imports-inline-script.md](issue/7m924q-harness-imports-inline-script.md) |
| `cjf54l` | dc-harness 引用闸（Python）：pytest 同级测试模块跨目录引用漏检；字符串里的 import 行 | done-creating-ledger | 2026-11-16 | [cjf54l-harness-python-pytest-path-strings.md](issue/cjf54l-harness-python-pytest-path-strings.md) |
| `h3mdcb` | generator tree check 比对的模块模板没有版本锁定，分不清手改与模板更新 | done-creating-analysis | 2026-11-16 | [h3mdcb-tree-check-unpinned-template.md](issue/h3mdcb-tree-check-unpinned-template.md) |
| `i5t6hl` | dc-harness check 有闸失败时不再列出通过的闸，分不清「通过」与「没跑」 | business-novel-studio | 2026-11-16 | [i5t6hl-harness-check-fail-summary.md](issue/i5t6hl-harness-check-fail-summary.md) |
| `rhfv9v` | dc-harness 引用闸：领域 public 不分使用方，给装配的入口（路由与默认实现）别的领域也能引 | business-strategy-studio | 2026-11-16 | [rhfv9v-harness-public-audience.md](issue/rhfv9v-harness-public-audience.md) |
| `w6d0yv` | dc-harness 缺口表闸：接缝件随替换整体消失、或同一文件先后承载两个接缝时，「已替换」规则套不上 | business-note-studio | 2026-11-16 | [w6d0yv-harness-seam-replaced-rules.md](issue/w6d0yv-harness-seam-replaced-rules.md) |
| `wf2exf` | create 没有按 template.lock.json 升级已生成应用的命令 | done-creating-asset | 2026-11-16 | [wf2exf-create-upgrade-from-lock.md](issue/wf2exf-create-upgrade-from-lock.md) |
| `xf85fi` | generator 没有以 OpenAPI 文档为输入的生成能力，生成调用层只能各仓接外部工具 | done-creating-ledger | 2026-11-16 | [xf85fi-generator-openapi-input.md](issue/xf85fi-generator-openapi-input.md) |
