---
id: ggjh2p
title: 能力目录：catalog 命令现取包与模板 + done-coding-catalog 技能
modules: [harness, create, generator]
created: 2026-11-16
source: 用户 2026-11-16 直接下达（总协调转达）；溯源 次级车道 › 混乱收拢到领域模块 › 共享能力可见
after: 2skbbw
---

# 能力目录

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| 下发批次 | 已完成 | c4afd8c |
| harness：`dc-harness catalog`（npm 已发布 + 注册表本机仓，按仓分系列；`--installed`；`--check`） | 已完成 | fa2f7e8 |
| create：`create-done-coding templates` 列项目模板（含 description），create-done-coding 技能改用它 | 已完成 | fa2f7e8 |
| generator：`dc-generator tree templates` 列模块模板基座与 whenToUse（与 MCP 同源，新增 `discoverBases`） | 已完成 | fa2f7e8 |
| 技能 `done-coding-catalog`；module-generate 示例对齐 forge；MODULES.md 登记新落点 | 已完成 | fa2f7e8 |
| 验收：三问实测、事实源对照、改动跟随 / 检查变红 | 已完成 | 记于下 |
| 刷新快照；归档本批，`gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 收工 | | |

## 边界

- 分支：`feat/capability-catalog` 叠在 `feat/harness-mechanical-gates`（49cd746）上——catalog 与 2skbbw 改同一组 harness 文件；push、合并、发版由用户执行。
- 只读别的仓；需要别仓配合的只写 issue 或记录。`~/.dotfiles`（含软链进去的 `~/.done-coding` 注册表）不改、不提 issue。
- 共享骨架独占：无（不加新依赖）。

## 设计与理由

- **数据一律现取，技能不带清单**（cli-skills 测试断言技能里出现的包名只有驱动查询的两个 CLI 包）：
  - done-coding 已发布包：npm 官方源按维护者检索，维护者与组织取自 `@done-coding/cli-harness` 自身的 latest 清单（不写死账号与组织）；只收 repository 在同一 GitHub 组织的包；逐包读 latest 拿描述、版本、依赖、弃用说明。
  - 本机仓：仓库注册表里登记的仓，按工作区声明读非 private 或带 `publishConfig` 的 npm 包，加 `packages/` 目录下名字合法的 pyproject.toml——done-creating 这类未上公共源的包从这里来，本仓不写它们的清单。
  - 系列 = 包所在仓；概述取注册表定位，否则取仓名去组织前缀后同名的聚合包描述。聚合 = dependencies 含 ≥ 2 个同系列包；peer 标「须搭配」。
  - 项目模板走 create 自己的清单解析（与交互选单同源），模块模板走 generator 的 `discoverTemplates`（与 MCP 同源），不在 catalog 里另读一遍。
- **怎么保证不过期**：每次现取、无缓存；`catalog --check` 在本机仓落后 npm、包缺描述、系列缺概述、清单读取失败或未比对时退出码 1，离线不显示为通过。
- **离线 / 没装全局工具**：技能三档调用（`done-coding` → `dc-harness` → `npx`）；`--offline` 只读本机仓；npm 未比对时 `--installed` 按本包与本机仓的 npm 作用域补列项目依赖并写明未核对；再不行按技能兜底读 `node_modules` 与 `npm view`。
- 取数用 Node 全局 fetch，不读 npmrc（`--registry` 可换）；Node fetch 不走 `http(s)_proxy` 环境变量，本机网络慢时偶发连接超时，已加退避重试，失败时如实报「未比对」。

## 验收（2026-11-16）

- **三问实测**：在 business-agent-studio `frontend/apps/web`（装了 forge 0.102.0 与 request-axios，未装 kit）用 `claude -p` 只读跑，先读本技能再答；`done-coding` 经验收转发脚本指向本分支构建（未发布）。结果：
  - 对话界面：选 `@done-coding/forge-kit-agent` 0.102.0（与已装 forge 同系列同版本、不在聚合入口需单独装），按组件源码的「何时不用」说明建议用 `AiMessageList` + `AiSender` 而非自带存储的 `AiDialogue`；排除 admin 系列的 `forge-agent` 0.6.0；给出安装命令并注明等确认、给出主包体积基线与比较步骤。
  - 静默续期：找到 `@done-creating/identity-login`（refresh_token 静默续期），查实未发布到本机私有源、identity 仓有未提交改动，建议不要手写、记一条等发布；identity 无收件箱，催发布需用户在 identity 会话推进。
  - 表格空状态：页面层（`AppPageListDetailLayout` `#empty` 插槽、模板参数 `listEmptyText`）可配且已在用；`TableMain` 内部空状态在 0.102.0 不可配（依据类型声明与构建产物）；空列表「下一步」入口已有接缝件 `ListEmptyStart.vue` 与 template-hub issue `sgzocr`。业务仓工作树零改动。
- **与事实源逐项一致**：forge 12 个包的描述与版本与本机 forge 克隆的 package.json 一致；`create templates` 的 25 个模板与 template-hub `templates.manifest.json` 逐项相同；`tree templates` 列出的 admin-core（4）与 forge（7）共 11 个模板的 whenToUse 与各 schema.json 一致（本机全局层未软链 py-fastapi，故不列）。
- **改动跟随 / 检查变红**（均在临时副本）：改 identity-login 描述 → 目录随之变；删描述 → `catalog --check` 报「缺 description」退 1；模板清单增一项删一项 → `create templates` 随之变；项目层改 list-page 的 whenToUse → `tree templates` 随之变（项目层优先）。
- **现有四个技能**：create-done-coding 改为用 `templates` 列模板并展示描述；module-generate 示例从已冻结的 admin-core 换成 forge（示例 vars 经 ajv 按 forge list-page schema 校验通过），MCP 工具描述的基座示例同改；cli-generator、cli-harness 与新目录无矛盾。
- 门禁：harness 71、create 50、generator 410、cli-skills 16、mcp 28 例全过；eslint 零报；create / generator 的 tsc 零错，harness 只有既有的 `issue.ts` 一处；三包构建退 0；提交后复跑同。

## 需要别仓配合（已投或待记录）

- done-coding-admin：已投 issue `4pri1k`（admin 提交 8b41bddc）——admin 系列已被 forge 取代，但 npm 未 deprecate、描述未标，目录无法提示。
- done-creating-identity（无收件箱，记录）：identity-login 的 `publishConfig`（私有源）只在工作树未提交，已提交版本是 private 且无发布源，按规则不进目录；且私有源上尚未发布该包。
- done-coding-forge（无收件箱，记录）：各包 README 无「何时不用」与空状态说明（agent 只能读源码注释与类型声明判断）。
- 仓库注册表（在 `~/.dotfiles`，用户改）：done-coding-request / x / url / nice、declar 未登记，系列无概述，`catalog --check` 因此为红；done-creating 除 identity 外的仓未登记，其包（契约包、ledger-writer 等）不会出现在目录里。
