---
id: 6u0t6n
title: cli 内容产物
modules: [showcase]
created: 2026-11-06
source: 用户 2026-11-06 当轮下发
after: ""
---

# cli 内容产物

## 任务

| 项 | 状态 | 交付 sha |
|---|---|---|
| [apps/showcase 导出 cli 内容产物](tw4ylf-content-export.md) | 实现与本地导出已验证，锁文件待主协调 | |
| 刷新所涉模块快照和上层摘要 | 已更新 | |
| 归档本批并跑治理闸 | 本轮保留 schedule；治理闸受依赖阻塞 | |
| 收工 | 本轮交接；未提交、未归档 | |

## 进度

ⓐ 已读根规则、开发流程、批次全部文件与站点仓 `AGENTS.md` 内容产物契约；初始 `git status --short` 为空。任务来源是本批 `tw4ylf-content-export.md`，事实依据是本仓 README、package.json、CLI handlers 与站点契约；不联网、不引外部实现。
ⓑ 授权边界：只写本仓，产物仅在 `test-results/`；不暂存、不提交、不 push、不发布、不调用模型、不读凭据。按本轮要求保留 schedule，归档和 sha 交主协调。
ⓒ 共享骨架独占：本批占用 `pnpm-workspace.yaml`、根 `package.json`（同步 workspace 声明）、`pnpm-lock.yaml`（仅 CI 同版本工具生成）；不改 `packages/cli` 实现、lerna 配置和 CI。

## 设计与执行计划

使用 brainstorming / writing-plans / test-driven-development / verification-before-completion 的适用步骤；用户已明确无人值守自行决定，跳过等待设计批准；不创建另一 worktree、不提交，计划与进度统一放本文件。

ⓐ 对比方案：站点框架构建会引入无关 UI 和依赖；简单复制 README 会留下失效链接。选择 Node 内置模块做白名单 Markdown 导出，按导出后的文件映射改写本地链接，并拒绝未纳入产物的本地资源。无新增运行时依赖。
ⓑ 私有 app：`apps/showcase/package.json` 声明 private，无 bin、不进 lerna 的 `packages/*` 发布范围；构建入口固定写 `test-results/showcase/content/`，不提供跨仓输出参数。
ⓒ 版本取主 CLI `packages/cli/package.json`，source 取 `done-coding-cli@<HEAD>`；本轮未提交改动不属于 HEAD，验收目录不能直接用于正式发布，主协调提交后须重新导出。
ⓓ 导出结构：`content/current.json` 与 `content/<version>/{docs,nav.json}`；导航契约未规定字段，自定为 `[{ text, link }]`，link 指向相对 `docs/*.md`，须在交接时说明。CLI 无演示需求，省略可选 demo。
ⓔ 逐包阅读用法与命令定义，保留用户配置、参数和限制，移除本仓开发/贡献流程、目录导航、更新日志链接；补缺少的 MCP 用法。批次是 generator 的公开功能词，不按关键词误删。
ⓕ 先写 Vitest 验证版本、导航、相对链接、失败不更新 current、重导出清理旧页、路径/软链防护及发布隔离；夹具全部放系统临时目录并清理。再实现、真实导出和静态审查。只跑本 app 单测、lint/build 与治理闸，不跑全仓单测/浏览器。
ⓖ 完成标准：导出文件只有 Markdown/JSON，覆盖根 README 与全部包 README；导航全部可达，本地文档链接可达；app 私有且发布包的清单/配置未扩容；所涉快照更新，验证逐项记录。

## 待用户裁决

暂无。导航字段由本批自行选择，站点接入时由主协调对齐；没有证据要求暂停。

## 验证记录

- 初始只读盘点：退出码 0；本机 `node --version` = v24.22.2，`pnpm --version` = 12.15.0，CI 锁定 10.33.0；已缓存 10.33.2 不能替代 CI 版本生成锁文件。

## 未完成与交接

实现、本地导出、所选单测/lint 与快照已完成；依赖恢复、锁文件生成、治理清单/闸未完成。归档与 sha 明确留给主协调。


## 实施进度

ⓐ 已新增私有 app、导出脚本与自包含 Vitest 测试；root/workspace 已登记 apps/*，lerna 与既有发布包配置未改。测试使用项目既有 Vitest ^1.6.1（MIT），仅作开发依赖；风险是本机安装未完成、锁文件缺 app importer，须由主协调用 CI 同版本安装生成。
ⓑ 根 README 与 15 份已有包 README 已逐篇审阅，其中 14 份包 README 改写，harness 的公开命令说明保留原样；补 `packages/mcp/README.md`。保留 generator 的公开“批次”概念、harness 的用户治理用法、create 的模板供答与 cc-switch 的配置说明；移除仓库开发/贡献步骤、源码目录导航及无导出的 CHANGELOG 链接。按 handlers 更正 extract/inject/template/publish 默认操作入口、configPath/rootDir 与 distTag 参数，未执行任何有副作用的产品命令。
ⓒ 实际导出遇到 `packages/.done-coding` 非包目录，补失败测试后按 package.json 识别包，修复后 14 项通过；追加 current 写失败回滚验证，总计 15 项通过。产物为 17 篇文档及导航、current，版本 0.23.3。
ⓓ 已更新 MODULES、上层摘要及 showcase 领域 README/SNAPSHOT。当前任务不触发其他领域实现变更，不改其他模块快照。

## 环境事故与恢复记录

ⓐ `pnpm exec eslint ...` 在本机 pnpm 12.15.0 下意外触发自动安装，沙箱网络拒绝下载；中断后退出 130。现有 root node_modules 链接/虚拟存储已失效，这是本次操作造成的，不能声称环境未变。Git 跟踪文件中的锁文件与发布配置未变。
ⓑ 用缓存 pnpm 10.33.2 尝试 `install --offline --frozen-lockfile --ignore-scripts --filter '!@done-coding/showcase'`，退出 1：缺 app importer（过滤不能绕开全 workspace 锁文件校验）。
ⓒ 为恢复原有依赖，临时将 app package.json 改名，使用缓存 10.33.2 跑 `install --offline --frozen-lockfile --ignore-scripts`（只读锁文件，不生成锁）；仍退出 1：`@done-coding/config-ui@0.1.0` 不在本地 tarball 缓存。已恢复 app package.json 原名，无跟踪文件遗失。
ⓓ 后续检查只借用兄弟仓已安装的 Vitest 1.6.1、ESLint 8.51.0 及 Prettier 可执行依赖，测试 root 指向当前 app、关闭缓存，不写兄弟仓。临时在本仓 ignored node_modules 建 Vitest 链接，收尾移除；这不能替代完整依赖恢复。
ⓔ `node packages/harness/es/cli.mjs check` 退出 1，缺 `@done-coding/output-node`，未执行到治理判断。不得记录为通过。


## 最终验证（实跑命令与退出码）

检查采用当前源码/产物；未跑全仓单测、浏览器、付费 API 或模型。借用依赖只读，无兄弟仓写入。Prettier 借用版本 3.9.10，与项目声明 ^3.8.0 相容；ESLint 8.51.0 和 Vitest 1.6.1 均是本仓原有锁定版本。借用工具只作当前验收，主协调仍需安装本仓依赖重跑标准入口。

| 实跑命令 | 退出码与证据 |
| --- | --- |
| `packages/harness/node_modules/.bin/vitest run --root apps/showcase --maxWorkers=1 --minWorkers=1` | 首轮 1（模块未创建，不能作为有效红灯）；增加占位实现后 1（13 项按未实现失败）；实现后 0（13/13） |
| `node node_modules/vitest/vitest.mjs run --root apps/showcase --maxWorkers=1 --minWorkers=1 --cache=false` | 非包目录用例先 1（13 过/1 败），修复后 0（14/14）；追加回滚用例及格式化后最终 0（15/15） |
| `node apps/showcase/export.mjs` | 首轮 1（误识别 packages/.done-coding）；修复后及最终重建均 0，17 篇，版本 0.23.3 |
| `NODE_PATH=../done-coding-forge/node_modules node ../done-coding-forge/node_modules/eslint/bin/eslint.js --resolve-plugins-relative-to ../done-coding-forge/node_modules apps/showcase/export.mjs apps/showcase/export.test.mjs` | 初次 1（回调超 3 参数）；改用 rest 参数后最终 0，无放宽规则 |
| `node ../done-coding.github.io/node_modules/prettier/bin/prettier.cjs --check apps/showcase README.md 'packages/*/README.md' package.json pnpm-workspace.yaml docs/governance/modules/showcase` | 1，格式差异含未改动的 harness README；仅对本批改动文件执行 --write（0），未扩大修改 harness |
| `node ../done-coding.github.io/node_modules/prettier/bin/prettier.cjs --check apps/showcase README.md packages/{cc-switch,cli-skills,cli,component,config,create,dex,extract,generator,git,inject,mcp,publish,template,utils}/README.md package.json pnpm-workspace.yaml docs/governance/modules/showcase` | 最终 0，全部匹配文件格式通过（实跑时列表逐项展开） |
| `node --input-type=module`（stdin 内联独立产物核验） | 0；枚举文件、检查导航目标与相对文档链接、读取 private/bin/lerna 范围，结果保存在 `test-results/showcase/verification.json` |
| `node packages/harness/es/cli.mjs check` | 1，缺 @done-coding/output-node，未执行治理判断 |
| `node ~/.cache/node/corepack/v1/pnpm/10.33.2/bin/pnpm.cjs gov:check` | 1，正式 npm script 入口同样因缺依赖失败 |
| `git diff --exit-code -- pnpm-lock.yaml lerna.json 'packages/*/package.json' .github/workflows` | 0，锁文件、既有包发布清单、lerna 与 CI 未改 |
| `git check-ignore test-results/showcase/content/current.json` | 0，验收产物被忽略 |
| `git diff --check` | 0 |
| `git diff --cached --quiet` | 0，未暂存 |

独立核验结果：19 个内容文件 = 17 Markdown + nav.json + current.json；17 条导航可达，39 个本地文档链接可达；无源码文件、source map 或软链。完整工作流未验收：不能把以上局部通过当作治理收口与依赖安装通过。

## 改动文件

- app：`apps/showcase/{package.json,README.md,export.mjs,export.test.mjs}`。
- 根：`.gitignore`、`README.md`、`package.json`、`pnpm-workspace.yaml`。
- 包 README：`packages/{cc-switch,cli-skills,cli,component,config,create,dex,extract,generator,git,inject,publish,template,utils}/README.md`，新增 `packages/mcp/README.md`；harness 已审阅但未改。
- 治理：`docs/governance/{MODULES.md,SNAPSHOT.md}`、`docs/governance/modules/showcase/{README.md,SNAPSHOT.md}`、本文件。任务正文未改，批次仍在 schedule。
- 本地产物（不入 Git）：`test-results/showcase/content/`、`test-results/showcase/verification.json`。
- 环境副作用：本仓 ignored node_modules 需要恢复；不是 Git 改动，不能通过 git diff 发现。借用 Vitest 临时链接收尾已移除。

## 主协调在沙箱外运行的准确命令

以下均在仓库根目录执行；不包含提交、push、发布或 Git 钩子安装：

```bash
# 恢复依赖并让 CI 同版本 pnpm 生成缺失的 app importer；禁用生命周期避免安装钩子
corepack pnpm@10.33.0 install --ignore-scripts
# 通过工具保持本仓锁文件格式，之后逐 hunk 确认仅预期 importer 变动
corepack pnpm@10.33.0 exec prettier --write pnpm-lock.yaml
git diff -- pnpm-lock.yaml
corepack pnpm@10.33.0 --filter @done-coding/showcase test
corepack pnpm@10.33.0 --filter @done-coding/showcase lint
corepack pnpm@10.33.0 --filter @done-coding/showcase build
corepack pnpm@10.33.0 gov:lists
corepack pnpm@10.33.0 gov:check
git diff --check
```

安装未执行完时不要用 pnpm 12 的 exec 重试，避免再次触发自动安装。锁文件本轮没有手改或删除重建；生成后预期仅新增 apps/showcase 的 vitest importer，不应接受无关依赖升级。若锁文件 diff 超出预期，由主协调按来源检查。

## 最终待用户裁决

无。导航采用 `{ text, link }` 是本批决定，成本是站点消费层接入时需要对齐字段；未更改站点契约，也未写站点仓。未提交内容无法由 HEAD 完整追溯，产物仅用于本地验收，主协调提交后须再 build。

## 最终未完成项

ⓐ 本机依赖恢复与 pnpm 10.33.0 锁文件生成：沙箱无法写全局 Corepack 缓存、不能联网补缺失 tarball；主协调运行上面的 install 命令即可继续。
ⓑ 安装后标准 app script 入口、治理清单与治理闸重跑。导出器本身可用 Node 直接运行，已完成真实导出。
ⓒ 批次归档与交付 sha：按用户指令保留 schedule，未暂存、未提交，由主协调完成。
ⓓ 未做站点渲染、站点跨仓接入或外部链接在线检查：本批只授权本地内容导出，且无须全量浏览器测试。

## 主协调交付（2026-11-06）

- 交付 `9584e89`（分支 feat/cli-showcase）：主协调用 pnpm 10.33.0 安装，锁仅新增 apps/showcase importer；showcase test 15/15、lint、build、治理闸通过。站点渲染与跨仓接入未做。
