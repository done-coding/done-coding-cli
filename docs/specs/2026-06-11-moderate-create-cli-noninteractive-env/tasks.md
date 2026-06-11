# create-done-coding CLI 非交互供答能力（--env / fast-fail / --list-questions）

> 状态：已完成
> 任务等级：Moderate
> 日期：2026-06-11
> 分支：`feat/create-local-template-config`（已有 3 个 commit 未 push；本任务在同分支追加，或按需另开 `feat/create-cli-noninteractive`）
> 本文件为单文件综合 spec（R+D+T），供 session-resume 断点续做。

---

## 背景与已复现证据（[MUST NOT] 重新调研，已确认）

下游用 AI/CI 无 TTY 驱动 `create-done-coding` 建项目，踩到：模板有"预设问题"（`.done-coding/template.json` 的 `collectEnvDataForm`，如 `organization`(默认 done-coding)/`name`(无默认=必填)）时，CLI 无法非交互供答。

**已复现（证据，勿重测即可信）：**
- 非 TTY + 不加 `--skipTemplateCompile` + 喂空行 `yes ''` → 「请输入包名/不能为空」15s 重复约 250 万次 → 死循环 → EINVAL。
- 喂 `/dev/null`(EOF) → 弹一次提问后中止，exit 0 但编译没拿到答案、产物错。
- `DONE_CODING_NON_INTERACTIVE=1` → 停在 `need_input`、项目不生成、问题未机读输出、无 CLI 完成通道。
- MCP `prepare→complete(envData)` 路径**本就能非交互跑**（已验证：无提问、无崩溃、建出项目）。

**根因：**
1. **能力缺口**：CLI 无 `--env`/`--env-file`；非交互 `handler` 走到 `need_input` 就 `return`，不调用 `completeCreateProject`，故无法单发供答建项目。
2. **bug（死循环）**：`packages/utils/src/handler-context.ts:55` `interactive` 默认 `mode==="cli"`（无 TTY 也=true）→ 走交互分支死等输入。而 `packages/template/src/handlers/batch-compile.ts:136` **已有**非交互 fast-fail（缺必填抛"缺少模板预置参数…当前为非交互模式"），只是 create 默认 interactive=true 没走到它。

---

## 现有内部件（复用，勿重造）

- `packages/create/src/handlers/create.ts`
  - `getOptions()`（约 81-136）：现有 `-n/-p/-b/--templateDirectory/--templateConfig/--openGitDetailOptimize/-m/--skipTemplateCompile`。**在此加新选项。**
  - `prepareCreateProject`（约 299）：模板有 `collectEnvDataForm` 时返回 `{status:"need_input", draftId, questions}`；`questions: CreatePrepareQuestion[]`（`{key,label,initial?}`，**required = 无 initial**）。会物化 draft 到 `<rootDir>/.done-coding/default/tmp/create/<draftId>/`。
  - `completeCreateProject`（约 512）：`applyTemplateCompile` 用 `argv.envData` → `batchCompileHandler({collectEnvData: argv.envData})`。**envData 通道已存在。**
  - `handler`（约 692）：交互→`interactiveCreateHandler`（死循环源）；非交互→`prepare`→`need_input` 时 **直接 return（缺口所在）**，否则 `complete`。
  - draft 助手：`getDraftDir`/`getDraftRootDir`/`readDraftState`（约 138-171），`safeRemoveDirSync` 可清 draft。
- `packages/create/src/types/index.ts`：`CreateOptions`（约 30-90）、`CreateCompleteOptions`（含 `envData?`）、`CreatePrepareQuestion {key,label,initial?}`。
- `packages/utils/src/handler-context.ts:55`：`interactive: ctx.interactive ?? getInteractiveFromEnv() ?? mode === "cli"`。
- `packages/template/src/handlers/batch-compile.ts:136/143/146`：非交互缺必填抛错；交互则 prompt（`请输入${label}` / `${label}不能为空`）。**[MUST] 确认它是逐个抛还是聚合所有缺失** → 验收要"列出缺失清单"，若逐个抛需小改为聚合。
- 占位语法 `${key}`；模板配置 `.done-coding/template.json`，`collectEnvDataForm[].key` 即 envData 的 key（**不是 label**；下游反馈示例用了中文 label 是误用，[MUST] 文档澄清 key）。
- MCP（`packages/mcp/src/handlers/create.ts`）：complete 工具已有 `envData`，**本任务不改 MCP**。

---

## 需求（4 条，按反馈）

- **REQ-1（核心）CLI 单发非交互供答**：新增 `--env '<json>'` 和 `--env-file <path.json>`，把预设问题答案非交互传入；非交互 `handler` 用其调用 `completeCreateProject`。两者都给时 `--env` 覆盖 `--env-file`（浅合并）。key 对齐 `collectEnvDataForm[].key`（= MCP envData 同一套 key）。
- **REQ-2（健壮性）非 TTY fast-fail**：无 TTY 时不死循环；缺必填项→非 0 退出 + stderr 列出**缺失的必填 key 清单**，[MUST NOT] 无限重问/EINVAL。
- **REQ-3（可发现性）`--list-questions`**：打印该模板预设问题清单（key + required(=无 initial) + default(initial)），机读（JSON），不建项目、不留 draft 残骸。
- **REQ-4 `--help` + README**：补 `--env`/`--env-file`/`--list-questions` 说明 + key 用 `collectEnvDataForm.key` 的澄清。

### Out-of-Scope（[MUST NOT] 触碰）
- [MUST NOT] 改 MCP（已有 envData）。
- [MUST NOT] 破坏现有 TTY 交互流程（`--env` 仅非交互补充）。
- [MUST NOT] 改模板编译引擎语义 / 占位语法。

---

## 设计

### D1 handler-context 非 TTY 默认（修死循环，REQ-2 根治）
`packages/utils/src/handler-context.ts:55` 改为 TTY 感知：
```ts
interactive:
  ctx.interactive ??
  getInteractiveFromEnv() ??
  (mode === "cli" && !!process.stdout.isTTY && !!process.stdin.isTTY),
```
理由：无 TTY → interactive=false → create 走非交互 prepare/complete → batch-compile 命中已有 fast-fail，不再死循环。
**风险/必验**：这是**共享 util**，影响所有命令（ai/template/inject…）。[MUST] 验证：① `-h`/`-v` 不受影响（不进 handler）；② 其它命令在 TTY 下行为不变；③ 显式 `DONE_CODING_NON_INTERACTIVE` / `ctx` 优先级不变。若风险过大，退路：仅在 create 的 interactive 分支入口按 `isTTY` 短路 fast-fail（次选）。

### D2 create 选项 + 单发供答（REQ-1/REQ-3）
`getOptions()` 加：
- `env`：`{ type:"string", describe:"模板预设答案(JSON)，如 --env '{\"organization\":\"acme\",\"name\":\"app\"}'" }`
- `envFile`：`{ type:"string", describe:"模板预设答案 JSON 文件路径" }`
- `listQuestions`：`{ type:"boolean", default:false, describe:"仅打印该模板预设问题清单(JSON)，不创建项目" }`

`CreateOptions` 类型加 `env?: string; envFile?: string; listQuestions?: boolean;`

envData 解析助手（create handler 内或 utils）：读 `envFile`(JSON) 作底 + parse `env`(JSON) 覆盖 → `Record<string,unknown>`；解析失败→明确报错退出非 0。

`handler`（非交互）改造：
1. 若 `argv.listQuestions` → 调 `prepareCreateProject` → 取 `questions`（need_input）或空（ready）→ 打印 JSON `[{key,required:!initial,default:initial}]` 到 stdout → **清理 draft**（`safeRemoveDirSync(getDraftDir(...))`）→ exit 0。
2. 否则解析 envData → `prepareCreateProject` → 若 `need_input` → `completeCreateProject({...argv, draftId, envData})`（**不再直接 return**）；缺必填由 batch-compile fast-fail（REQ-2）。
3. 交互分支（TTY）保持不变。

### D3 缺失必填清单（REQ-2 验收"列出清单"）
确认 `batch-compile.ts:136` 行为：若逐个抛 → 小改为**先扫一遍所有缺失 key 聚合后一次抛**（错误信息列全部缺失 key）。若已聚合则不改。[MUST] 先读该文件确认。

### D4 README + --help（REQ-4）
`packages/create/README.md` 加"非交互供答"节：`--env`/`--env-file`/`--list-questions` 用法 + key=`collectEnvDataForm.key` 澄清 + 非 TTY fast-fail 说明 + 一个完整 npx 示例。

---

## 任务清单

- [x] T1 读 `batch-compile.ts`：确认为**逐个抛且不分有无 initial** → D3 需改（聚合 + initial 回落）
- [x] T2 `handler-context.ts:56` 改 TTY 感知默认（D1）
- [x] T3 `create/types/index.ts`：`CreateOptions` 加 `env`/`envFile`/`listQuestions`
- [x] T4 `create/handlers/create.ts`：`getOptions` 加 3 选项 + `resolveCliEnvData`/`parseEnvJsonObject` 助手
- [x] T5 `create/handlers/create.ts`：`handler` 非交互改造（`listTemplateQuestions` 出口 + 单发 complete with envData + 失败清理草稿）
- [x] T6 `batch-compile.ts`：聚合缺失必填一次抛 + 有 initial 回落默认（D3）
- [x] T7 `README.md` 补「非交互供答」节（D4）
- [x] T8 build + lint（4 包 build 通过；create/template/utils lint 通过）
- [x] T9 e2e 验收（A1-A5 全 PASS，见下）
- [ ] T10 commit（同分支追加；不 push）

### 实施补充（落地细节，与 spec 设计的偏差/增强）
- D3 不只聚合，还**修正了非交互语义**：原代码对「有 initial 但未供答」也抛错；改为有 initial 回落默认（对齐 REQ-2「必填=无 initial」）。
- `--list-questions` 两处必须处理：① outputConsole 全走 **stdout**（实测），故 `updateEnvConfig({consoleLog:false})` 静默装饰日志保 stdout 纯 JSON；错误改写 `process.stderr` 防被静默吞。② prepare 需 projectName，用合成名 `__list_questions_probe__` 跑 prepare，结束清理草稿。
- 非交互单发失败时清理本次 draft（防 `.done-coding/default/tmp/create` 残骸累积），属 A2 副作用增强。
- `--env-file` 经 yargs camel-case 展开等价 `--envFile`，help 显示 `--envFile`。

### 后续增强（同任务追加）
- 沉淀可复跑 e2e：`packages/create/test/noninteractive.e2e.test.ts`（vitest，仓库既有选型 ^1.6.1）。覆盖 --env / --env-file / initial 回落 / --env 覆盖 --env-file / 缺必填 fast-fail（spawnSync timeout 守死循环）/ --list-questions 纯 JSON。`beforeAll` 自动构建依赖链（`DC_SKIP_BUILD=1` 跳过加速）。`pnpm --filter create-done-coding test` 运行。
- CLI 报错出口归正：`packages/utils/src/cli.ts` `failHandler` 由 `outputConsole.error`(stdout) 改为 **stderr**（保留文件日志），落实「stdout 只输出数据/机读、诊断走 stderr」。影响所有命令的报错通道（共享 util），属正确改进。

---

## 验收标准（可观察，e2e）

用最小模板：`.done-coding/template.json` 含 `collectEnvDataForm:[{key:organization,initial:done-coding},{key:name}]`，`package.json={"name":"@${organization}/${name}"}`。本地 git 仓 + `-p` 指它，非 TTY（`</dev/null` 或后台轮询，macOS 无 `timeout`，用后台+poll+kill）。

- [ ] A1 `create -n app -p <tpl> --env '{"organization":"acme","name":"app"}' --openGitDetailOptimize=false`（非 TTY）→ exit 0，生成 app/，`package.json` name = `@acme/app`（占位已编译）。
- [ ] A2 同上但 `--env '{"organization":"acme"}'`（缺 name）→ exit≠0，stderr 列出缺失必填 `name`，**无 EINVAL/无死循环**（后台 poll 确认 ≤数秒退出）。
- [ ] A3 `create -p <tpl> --list-questions` → stdout 打印 `[{"key":"organization","required":false,"default":"done-coding"},{"key":"name","required":true}]` 类 JSON，不建项目、无 draft 残留。
- [ ] A4 TTY 交互流程回归不破（无 `--env` 时仍可交互；至少确认 `create -h` 列出新选项、构建产物可跑）。
- [ ] A5 其它命令未被 D1 误伤（spot check：`done-coding -h`、`done-coding ai -h` 等不报错）。

---

## 备注
- es/types 已 gitignore，仅 src+docs 纳管；commit 只 src+docs。
- lint-staged 会在 commit 时自动 eslint --fix + prettier。
- 本机 sandbox 间歇 `uv_cwd` EPERM（环境抖动），node 启动崩与代码无关，重试即可。
