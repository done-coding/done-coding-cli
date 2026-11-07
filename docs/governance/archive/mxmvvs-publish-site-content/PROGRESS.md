---
id: mxmvvs
title: 内容产物发布到组织站
modules: [showcase]
created: 2026-11-06
source: 用户 2026-11-06 当轮下发
after: ""
---

# 内容产物发布到组织站

## 任务

| 项 | 状态 | 交付 sha |
|---|---|---|
| [显式发布命令](4pqpty-publish-command.md) | 已实现，逐条测试与本地验收通过 | 本轮不提交 |
| 刷新所涉模块快照和上层摘要 | 已更新 | 本轮不提交 |
| 归档本批并跑治理闸 | 保留 schedule；治理闸通过，归档交主协调 | |
| 收工 | 本轮实现与核验完成，交主协调 | |

## 进度

ⓐ 已读批次条目、根 AGENTS、治理 AGENTS/DEVELOPMENT、领域快照、现有导出/测试/README；组织站仅只读其 AGENTS 内容产物契约。初始工作树干净，分支 feat/cli-showcase，不切换。
ⓑ 本次授权：只改本仓；不暂存、不提交、不 push、不发布、不联网、不读 .env、不改 CI、不装钩子。测试只用系统临时夹具；批次保留 schedule，提交与归档交主协调。
ⓒ 来源：本仓既有导出实现、已安装 Vitest/ESLint、组织站契约；使用 Node 内置模块，不引依赖。现有实现无独立扫描；导航 docs/ 前缀不符合当前契约，须修正。
ⓓ 根 AGENTS 与治理规则未见风险表。按影响选择 showcase 全套 test/lint/build、Git 临时仓集成、扫描/路径/回滚测试；不跑无关包、站点构建或联网检查。

## 实施计划与完成标准

使用 writing-plans、TDD 与完成前验证的适用流程，计划集中在本文件。需求已明确执行，不另建 worktree、不等待设计确认。

- [x] ⓐ 先写发布测试：缺参、非 Git/嵌套目录、缺契约/目录、源/目标脏工作区；成功与重复发布、保留旧版本、扫描失败、路径/软链、current 失败回滚。运行确认因功能缺失失败。
- [x] ⓑ 从 export.mjs 提炼共用内容收集、扫描、原子安装，新增 publish.mjs 与 package script；导航改为相对 docs/。只用显式站点根，不猜环境变量，不提交或推送。
- [x] ⓒ 跑 showcase 全套测试与 lint/build；逐条对应条目验收。刷新 README、领域快照与上层摘要，记录命令/结果与未验证项。

完成标准：验收各项均有临时夹具测试与通过证据；真实本地导出仍通过；不写组织站、不触碰共享骨架/CI，批次留 schedule。


## 实施记录

ⓐ 先写 30 项发布测试并修改导航契约断言；用未实现占位运行，首轮 30 失败/15 通过，确认缺功能及旧导航失败。修正回滚断言为真实 rename 错误，增加扫描占位后再红灯 28 失败/17 通过；共用扫描未实现占位的部分断言通过，实际扫描实现后另用敏感路径红灯验证。
ⓑ 提炼 collectContent / scanContent / installContent，共用收集、写入前扫描、临时目录、rename 与失败回滚。publish:content 只接受一个显式站点根参数；Git 校验仅运行只读命令，真实两仓不暂存/提交。
ⓒ 首轮实现后 45/45；发现反引号内路径和 /usr/local 漏扫，先增 3 项测试，实跑 3 失败/45 通过，修正后 48/48。补缺 AGENTS 文件及 CLI 从其他目录成功运行的集成核验，最终 50/50。
ⓓ 首次 lint 发现 one-var 错误和 regex 警告，已修正且没有放宽规则。首次本地导出被 harness README 的机器路径示例阻止，改为“全局配置仓的绝对路径”占位说明，随后 17 篇导出成功。未改 harness 实现。
ⓔ 未引依赖，仅用 Node 内置模块和已安装的 Vitest/ESLint。误将 prettier 的 shell 包装器交给 node 执行，报 SyntaxError，未写文件；改用包装器直接执行后格式化成功。
ⓕ 测试 Git init/add/commit 仅用于系统临时夹具，禁用 hooks/签名/全局配置，结束清理；未操作本工作仓 index 或 HEAD，未写真实组织站。未改根 package/锁文件/CI，无共享骨架占用。

## 验收映射

| 条目 | 证据 |
| --- | --- |
| 缺路径、非 Git 根、缺契约/AGENTS、缺 content | 临时仓失败断言 + 全夹具文件树前后不变 |
| 目标 content 脏、来源仓脏 | tracked/untracked/staged，目标额外含 ignored；失败前后文件树不变 |
| 正常发布与重复结果、保留其他版本 | 版本/current/nav 精确断言、文件数、来源 HEAD、其他版本内容；站点提交夹具后重复发布树一致，命令本身不改 HEAD/index |
| 同版本整体替换 | 预置 stale.md 被移除 |
| 扫描失败不写入 | map/源码/穿越文件名扫描；map 引用、macOS/Linux/Windows/反引号路径注入文档，发布前后文件树不变 |
| 路径安全与失败回滚 | 站点根/路径段/版本/current/旧版内部软链、穿越拒绝；current 为目录时还原旧版并清理临时目录 |
| 原导出与 CLI | 导出 15 项保留；CLI 缺参/多参非零、正常跨 cwd 调用摘要、无真实提交；本地 build 导出 17 篇 |

## 最终核验

标准入口使用本机缓存的 pnpm 10.33.0（与 CI 一致），无安装、无网络。命令前缀可记为 `node ~/.cache/node/corepack/v1/pnpm/10.33.0/bin/pnpm.cjs`，测试在 Bash 沙盒中执行。

- `pnpm --filter @done-coding/showcase test`：50/50，2 个文件通过，退出 0。
- `pnpm --filter @done-coding/showcase lint`：最终重跑退出 0。
- `pnpm --filter @done-coding/showcase build`：最终重跑退出 0，0.23.3、17 篇。
- `pnpm gov:check`：退出 0，元闸 / 并行闸 / 收口形态 / 清单全过；没有归档或重生成清单（条目位置未变）。
- 独立 Node 产物核验：退出 0；0.23.3、17 篇 Markdown、19 个文件（含 nav/current）、17 条导航按 docs/ 相对路径全部可达，无软链，文件扩展名限 md/json。
- `prettier --check apps/showcase`：退出 0；未对现有治理文档整体格式化。
- `git diff --check`、`git diff --cached --quiet`、共享骨架/CI 路径 `git diff --exit-code`：均退出 0；工作树仅本批文件修改/新增，index 为空。

## 未执行与主协调交接

ⓐ 未写真实组织站，未跑组织站构建、线上部署或联网链接检查；本轮授权只允许本仓与临时夹具。没有真实发布成功的声明。
ⓑ 本仓保留未提交实现，正式命令应拒绝当前脏工作区。主协调审阅提交后，获得跨仓写入授权时再执行 `pnpm --filter @done-coding/showcase publish:content <站点仓根>`；站点仓提交另行处理。
ⓒ 本轮不暂存、不提交、不 push、不发布、不归档，条目正文不迁移、不改写。提交 sha 与归档由主协调完成。暂无资源/权限阻塞。


## 改动文件

- `apps/showcase/publish.mjs`、`apps/showcase/publish.test.mjs`：显式命令与 35 项发布/扫描/CLI 集成核验。
- `apps/showcase/export.mjs`、`apps/showcase/export.test.mjs`：共用收集/扫描/原子安装，导航契约修正，保留 15 项导出测试。
- `apps/showcase/package.json`、`apps/showcase/README.md`：publish:content 入口、全 app lint、命令用法与限制。
- `packages/harness/README.md`：仅一处机器路径示例换为占位说明。
- `docs/governance/modules/showcase/{README.md,SNAPSHOT.md}`、`docs/governance/SNAPSHOT.md`：领域现状与上层摘要。
- 本批 `PROGRESS.md`：计划、过程、验收映射、结果与交接；需求正文未动。
- Git 忽略的 `test-results/showcase/content/`：仅本仓本地重建，未写真实站点仓。

## 主协调交付（2026-11-06）

- 交付 `1558540`（分支 feat/cli-showcase）。主协调复跑 showcase 测试 50/50、lint 通过；真实组织站写入由主协调执行并单独提交站点仓。
