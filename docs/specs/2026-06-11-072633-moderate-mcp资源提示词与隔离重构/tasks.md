---
任务等级: Moderate
状态: 进行中
日期: 2026-06-11
关联: requirements.md（已通过）+ design.md（已通过）
分支: feat/create-local-template-config（同分支追加，不 push）
---

# 实施任务：create-mcp 三原语 + 模板来源结构性隔离

> session-resume 锚点。需求+设计均已通过，可直接进实施。续做[MUST]先读本目录 requirements.md + design.md（含 SDK 签名/文件落点/隔离推理/URI 风险，勿重查 SDK）。

## 当前进度块（续做从这里看）
- 需求审核：✅ 已通过（用户确认 REQ 全 + 3 决策点）
- 设计审核：✅ 已通过（PM 轻量自审）
- 实施：⬜ 未开始（从 T1 起）

## 背景速记（勿丢）
- 三决策点已定：① 移除 `done_coding_list_create_templates` 工具；② prepare 的 `templateUrl` 改 zod 必填；③ 回退 commit `4fd5b0e` 的 mode 闸，隔离改靠 zod 结构边界。
- 隔离原理：prepare templateUrl 必填 ⇒ MCP 永带 url 进 `resolveTemplateSourceInfo` ⇒ 不进 `getTemplateList` ⇒ 不读全局/远程/不联网。
- 已确认 SDK：`registerResource(name, ResourceTemplate, config, cb)` / `registerPrompt(name, {title,description,argsSchema}, cb)` / `ResourceTemplate(uri, {list:undefined})`；详见 design.md §0。
- CLI 优先级链（`--templateConfig > 全局指针 > 远程`）**本期不动**。

## 任务清单
- [ ] T1 回退 mode 闸（REQ-4）：删 `packages/create/src/handlers/create.ts` `resolveTemplateSourceInfo` 内 `4fd5b0e` 加的 `ctx.mode==="mcp"` 抛错段（约 6 行，见 design §4）；清理因此产生的未用调用/import 残留（`resolveHandlerContext` 别处仍用→保留 import）。
- [ ] T2 prepare zod 必填（REQ-2）：`packages/mcp/src/handlers/create.ts` `prepareInputSchema.templateUrl` 由 `z.string().optional()` → `z.string()`。
- [ ] T3 移除 list 工具（REQ-2）：删 `done_coding_list_create_templates` 的 `registerTool` 整段；清理仅它用到的 import 残留（`readTemplateListFromFile` 仍被资源回调用→保留）。
- [ ] T4 资源回调纯函数化 + 注册（REQ-1）：抽 `readTemplateListResource(configPath)` 纯函数（或在 create 包导出 helper）；用 `ResourceTemplate("done-coding-create-template-list://{+configPath}", {list:undefined})` + `registerResource` 注册；回调只调 `readTemplateListFromFile`（本地、不联网），configPath 空→抛错。见 design §1。
- [ ] T5 引导 Prompt（REQ-3）：`registerPrompt("create-done-coding-project", {argsSchema:{configPath, projectName?}}, cb)`，返回引导 messages（资源→prepare→complete）。见 design §3。
- [ ] T6 main.ts 接线：`registerCreateTools` 之外补 `registerCreateResources` / `registerCreatePrompts`（或合并进现有注册函数），确保 server 启动注册三原语。
- [ ] T7 测试改造（REQ-5）：
    - 改 `packages/create/test/mcp-template-isolation.test.ts`：删"guard 抛 /MCP/"断言；改测 prepare schema 缺 templateUrl 被 zod 拦 + 资源回调（本地列表/空 configPath/不存在文件）+ URI `{+configPath}` 真实绝对路径 round-trip。
    - 验证 `noninteractive.e2e.test.ts` 6 用例不回归。
- [ ] T8 文档（REQ-6）：`packages/create/README.md` MCP 小节更新为资源+prompt+prepare 必填+不联网新形态。
- [ ] T9 build + lint：`npx lerna run build --scope=@done-coding/cli-utils --scope=@done-coding/cli-template --scope=create-done-coding --scope=@done-coding/cli-mcp`；`pnpm eslint`（create src+test、mcp src）。
- [ ] T10 跑测试：`pnpm --filter create-done-coding test`（+ 若加 mcp 测试）。全绿。
- [ ] T11 验收（测试专家技术验证：build/lint/vitest 退出码+时间戳）→ 当前甲方最终验收。
- [ ] T12 commit（同分支追加；conventional 中文开头避 subject-case；不 push）。归档协议（含 RETROSPECTIVE）。

## 风险/注意
- **URI `{+configPath}` round-trip**（design §1 设计风险）：实施 T4/T7 [MUST] 验证 SDK `UriTemplate` 支持 reserved expansion 且绝对路径能解析回原值；不行则按 design §1 回退方案（query 参数 / 百分号编码 + decodeURIComponent）。
- commitlint `subject-case`：commit subject [MUST] 中文开头（"MCP"开头会被拒，见上一 commit 教训）。
- es/types gitignore：只提交 src+test+docs。
- lint-staged 自动 eslint --fix + prettier。
- [MUST NOT] 碰 CLI 优先级链 / readTemplateListFromFile 语义 / review 发现的安全问题（另立任务）。
- 回退 guard 后，导出函数 `prepareCreateProject` 编程式直调无 mode 隔离——这是已接受的取舍（隔离边界上移到 MCP 工具 zod 层），[MUST] 在代码注释 + README 诚实标注。
