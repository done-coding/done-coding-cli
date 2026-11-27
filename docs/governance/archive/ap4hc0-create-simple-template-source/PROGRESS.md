---
id: ap4hc0
title: create 本机模板来源还原为简单流程，去掉 template.lock
modules: [create]
created: 2026-11-27
source: 用户 2026-11-27 会话内定（「项目脚手架读取模板列表看配置 不要节外生枝 弄的很复杂」）；issue xe4f1g、7xqj4i（from blueprint）一并结掉
after: ""
---

# create 本机模板来源还原为简单流程，去掉 template.lock

## 目标（用户口径）

create 的流程：拉取模板列表 → 选择模板 → 模板放到临时目录 → 复制模板 `directory` 到目标目录 → 模板问题与预编译生成项目。

- 模板列表配置在本机没问题，这一步只是拿到列表。
- 模板 url 是本机路径：在该仓 `git worktree add` 到临时目录，取该仓当前所在分支（HEAD），不选分支、不联网、不猜远端默认分支；模板 url 是远程地址：`git clone --depth=1` 到临时目录。之后两者完全相同。
- 模板列表项或 `-b` 显式指定了分支才用该分支（与 0.19 相同）。
- `template.lock.json` 移除。
- AI 经 MCP 调用脚手架是明确需求，保留。

## 任务

| 项 | 状态 | 交付 sha |
| --- | --- | --- |
| 下发：issue xe4f1g、7xqj4i 从 `issue/` 移入本批 | 已完成 | cca5ca3 |
| 本机模板：去掉 fetch / ls-remote / 候选分支挑选 / 本地领先告警，取 HEAD（或显式分支）；模板目录不存在时报错点名模板仓与目录 | 已完成 | 85dceae |
| 临时 worktree 残留：`worktree add` 改 `--detach`（不再建临时分支）并挪进 try，失败也清理 | 已完成 | 85dceae |
| 去掉 template.lock 写入（7xqj4i）；不再取本地模板仓 origin 地址 | 已完成 | 85dceae |
| create 目标定义写入 `modules/create/README.md`；更正 zsz54k / ynfow5 归档里「用户定」的记录 | 已完成 | 9521d7c |
| 刷新 create 快照、上层 SNAPSHOT、BUSINESS_SNAPSHOT、create README、create-done-coding skill | 已完成 | 85dceae（README / skill）、9521d7c（快照） |
| 全量检查（create build + 包内全部 vitest 含 e2e + `eslint .`；cli-skills、mcp vitest）：用户 2026-11-27 会话内批准，经 heavy-lock 跑 | 已完成 | 85dceae 上验证 |
| 归档本批，`pnpm gov:lists` / `gov:check` 通过 | 已完成 | 本归档提交 |
| 收工 | | |

## 边界

- 分支：从 `chore/release-closeout-2026-11-21`（`ff117a8`，含收件 issue）切 `fix/create-simple-template-source`；push、合并、发版由用户在会话内亲自确认（转达不算）。
- 只改本仓；template-hub 只读，残留只报告不清理。
- 本机只跑轻量检查（改动文件的定向单测、eslint / prettier）；全量测试、包 build、整仓类型检查走总协调排队，待用户批准。
- 共享骨架独占：无。

## 进度

### 根因（2026-11-27）

- xe4f1g：本机模板未传 `-b` 时 `resolveLocalDefaultRef` 先 `git fetch origin`（`stdio: pipe`、无超时、无提示），SSH 需交互确认或断网即无输出挂起。zsz54k 引入，g4p7sa 又加 `ls-remote`。修法：本机模板不联网，取 HEAD。
- 7xqj4i：zsz54k 在编译后、git 初始化前写 `template.lock.json`，随初始提交入库，含本机绝对路径与 `remoteUrl`。修法：按用户口径整体移除。
- template-hub 残留（只读核查，未动）：4 条 prunable worktree（`.git/worktrees/{6b8f19bb,10ba7e12,0695522a,872c27e1}`，11-13 21:55 / 22:47、11-16 14:27 / 15:55 建）+ 5 条 `done-coding-template-*` 分支（其中 `4ac408be` 11-16 22:07 无对应 worktree 记录）。临时目录仍在、只剩空目录（系统 tmp 清理 03:37 删了文件），说明 `worktree add` 之后清理没执行（进程在 add 与 finally 之间被终止）；`4ac408be` 是 worktree 已移除但 `branch -D` 失败或未执行。代码缺陷：`worktree add -b` 每次在模板仓建临时分支，且 add 在 try 外。修法：`--detach` 不建分支，add 挪进 try；被强杀时最多留一条 prunable 记录（`git worktree prune` 可清），不再留分支。

### 实现与验证（2026-11-27）

- `85dceae`：`templateSource.ts` 删 `fetchOrigin` / `resolveOriginHeadCandidates` / `resolveLocalDefaultRef` / `warnLocalAhead` / 旧 `missingTemplateError`（约 150 行）；`create-artifacts.ts` 删 `writeTemplateLock` / `readTemplateSecretKeys`；草稿状态去 `templateRemoteUrl` / `secretKeys`。
- 本机轻量验证：`template-provenance.test.ts` 12 例全过（新增：origin 不可达时取 HEAD 已提交内容且无告警、显式分支 / 标签、模板目录缺失报错文案、模板仓无 worktree / 临时分支残留、complete 不写 lock 且注册表不记未指定分支）；改动文件 eslint 退 0、prettier 通过；create `tsc --noEmit` 退 0。
- 未跑（重任务，待批准）：create build、包内全部 vitest（`noninteractive.e2e` 依赖 `es/` 构建产物）、`eslint .`；cli-skills / mcp vitest。
- 发现未处理：`packages/template/src/index.ts` 注释仍写「secret key」，属 template 包，改注释会让 lerna 给该包定版，未动。

- 2026-11-27：重任务申请已发总协调 blueprint-3a，回复「已转用户、暂未放行」；该会话今后不再协调 done-coding-* 事务（用户将另开专门会话）。放行须用户本人在本会话确认，之前保持 85dceae 现状。

### 全量检查（2026-11-28，用户 11-27 会话内批准）

- 经 `blueprint/tools/heavy-lock.sh` 跑（本会话按用户批准登记 utility 许可 2 次）：create `build` 退 0；create `vitest run` 7 文件 52 例全过（含 `noninteractive.e2e`）；create `eslint .` 退 0；cli-skills vitest 3 文件 16 例全过；mcp `vitest run` 3 文件 28 例全过。
- 插曲：cli-skills 的 `test` 脚本是不带 `run` 的 `vitest`（监听模式），用例 22:29 已全过但进程不退出，空占锁约 2.5 小时，mcp 因此未开跑；发现后停掉、mcp 另登 1 次许可补跑。cli-skills `test` 脚本与 create / mcp 不一致（未改，属该包脚本，另议）。

