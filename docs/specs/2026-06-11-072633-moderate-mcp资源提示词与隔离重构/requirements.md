---
task_subtype: 常规需求
任务等级: Moderate
审核状态: 已通过（用户 2026-06-11 确认 REQ 全通过 + 3 决策点 ✅）
日期: 2026-06-11
分支: feat/create-local-template-config
---

# create-mcp 引入 Resources/Prompts + 模板来源结构性隔离

> 文档定位：快照型需求规格。需求审核通过前 `审核状态` 不置"已通过"。

## 背景

`create-mcp`（`@done-coding/cli-mcp`，SDK `@modelcontextprotocol/sdk@1.29.0`）当前**只注册 3 个 Tool**（list/prepare/complete），没有 **Resources**、没有 **Prompts**。诉求：

1. MCP 应先**引导客户端发现"有哪些模板"**——把模板列表做成可发现的 **Resource**（取资源时传入本地 configPath，zod 强制、不联网、不读全局/远程）。
2. MCP 服务应完整具备三原语：**Tools + Resources + Prompts**。
3. 设计精炼（用户裁定）：configPath 在**取资源时**传入；prepare 拿到的是已选好的 `templateUrl`，所以**进入 CLI handler 后整体无 mcp/cli 模式分叉**——隔离改由 **zod 结构边界**保证（prepare 的 `templateUrl` zod 必填 ⇒ MCP 永不触达 `getTemplateList` 的全局/远程路径），而非运行时 mode 闸。

已确认事实（勿重查）：
- SDK 1.29.0 支持 `registerResource`（静态 URI 或 `ResourceTemplate` 参数化）、`registerPrompt`、`registerTool`。
- 当前 isolation 由 commit `4fd5b0e` 在 `create/src/handlers/create.ts` 的 `resolveTemplateSourceInfo` 加的 `ctx.mode==="mcp"` 运行时闸实现——本任务[MUST]按新设计**回退**它。
- CLI 模板来源优先级链（上一任务已定，**本任务不动**）：`--templateConfig` > 家目录全局指针 `~/.done-coding/create/index.json` > 远程默认（保留远程兜底）。
- `readTemplateListFromFile(configPath)`（create/src/utils/local-config.ts）已是"只读本地、不联网、非数组/缺失返回 []"。

## 需求条目

### REQ-1 模板列表 Resource（取资源时传 configPath，zod 强制本地）
- [MUST] 用 `ResourceTemplate` 注册一个**参数化**资源，URI 含 `configPath` 参数（具体 URI 方案见设计阶段，候选 `done-coding-create-template-list://{configPath}`）。
- [MUST] 读取该资源 = 调 `readTemplateListFromFile(configPath)` 返回本地 `{templateList:[...]}` 的模板列表（JSON 文本 contents）。
- [MUST] **不联网、不读家目录全局指针、不读远程默认**。
- [MUST] `configPath` 缺失/为空 → 资源读取按 MCP 规范返回错误（不静默联网、不回落）。
- 可观察验收：用一个本地 `{templateList:[{name,url}]}` 文件，经资源读取返回该列表 JSON；configPath 指向不存在文件 → 返回空列表或明确错误，且无网络调用。
- 边界：configPath 非绝对路径 / 指向非 JSON / templateList 非数组 → 复用 `readTemplateListFromFile` 既有兜底（[]＋告警），[MUST NOT] 抛崩溃。
- Out-of-Scope：本期**不做**单模板详情资源（`.../{name}`）；不做资源变更订阅(subscribe)。

### REQ-2 工具重构：移除 list 工具 ★决策点1，prepare 的 templateUrl 改 zod 必填 ★决策点2
- ★**决策点1**：[MUST] **移除** `done_coding_list_create_templates` 工具——其"按 configPath 列模板"职责由 REQ-1 的 Resource 取代（用户："工具那里不为 mcp 设置单独的配置文件配置入口，因为配置文件在取资源时传入"）。
- ★**决策点2**：[MUST] `done_coding_prepare_create_project` 的 `templateUrl` 由 `optional` 改为 **zod 必填**（来自资源选型）。`templateGitPath` 等保留 optional。
- [MUST] `done_coding_complete_create_project` 不变。
- 可观察验收：MCP 工具清单只剩 prepare/complete；prepare 缺 `templateUrl` 被 zod 拦截（参数校验失败），不进入任何模板列表解析。

### REQ-3 引导 Prompt
- [MUST] `registerPrompt` 注册一个引导提示词（候选名 `create-done-coding-project`），引导完整流程：读模板列表资源(带 configPath) → 选模板 → `prepare`(传 templateUrl) → 按 `need_input.questions` 提供 `envData` → `complete`。
- [SHOULD] Prompt 接受参数（如 `configPath`、`projectName`）以便填充引导文案；具体参数集见设计阶段。
- 可观察验收：MCP `prompts/list` 含该 prompt；`prompts/get` 返回引导消息文本，串起资源→prepare→complete。

### REQ-4 回退 mode 闸，隔离改由结构保证 ★决策点3
- ★**决策点3**：[MUST] **回退** `4fd5b0e` 在 `resolveTemplateSourceInfo` 加的 `ctx.mode==="mcp"` guard——CLI handler 内**不再有 mcp/cli 分叉**。
- [MUST] 隔离改由结构边界保证：REQ-2 的 prepare `templateUrl` zod 必填 ⇒ MCP 运行时永不以"无 templateUrl"进入 `getTemplateList` ⇒ 不读全局/远程、不联网。
- [MUST] `createMcpContext` 仍 `mode:"mcp"`（非交互/日志用途不变），但[MUST NOT]再用于模板来源分叉。
- 诚实标注（设计阶段写入）：导出函数 `prepareCreateProject` 本身（被测试/编程式直接调用时）不再有 mode 隔离——隔离边界上移到 **MCP 工具的 zod 层**；MCP 运行时唯一入口是该 zod-guarded 工具，故运行时保证成立。
- 可观察验收：移除 guard 后，MCP 实际调用路径（prepare 工具必带 templateUrl）不触达 getTemplateList；CLI 交互/非交互流程不受影响。

### REQ-5 测试改造（含回退导致的既有测试更新）
- [MUST] 既有 `packages/create/test/mcp-template-isolation.test.ts` 依赖"guard 抛 /MCP/"——guard 回退后该断言失效，[MUST] 改为验证**新结构边界**：prepare 工具的 zod schema `templateUrl` 必填（缺失被拦），不触发网络。
- [MUST] 新增/调整测试覆盖：REQ-1 资源读取返回本地列表、configPath 缺失处置；REQ-2 工具清单 + prepare zod 必填；REQ-3 prompt 存在且可 get。
- [MUST] 既有 `noninteractive.e2e.test.ts` 6 用例保持通过（不回归）。
- 可观察验收：`pnpm --filter create-done-coding test` 全绿；`pnpm --filter @done-coding/cli-mcp test`（若新增）全绿。

### REQ-6 文档同步
- [MUST] `packages/create/README.md` 的"MCP 模式"小节更新为新形态（资源发现 + prompt 引导 + prepare 必填 templateUrl + 不读全局/远程/不联网）。
- [SHOULD] `packages/mcp/README.md`（若有）补三原语说明。

## Out-of-Scope（[MUST NOT] 触碰）
- [MUST NOT] 改 CLI 模板来源优先级链（`--templateConfig > 全局 > 远程`，上一任务已定、本期不动）。
- [MUST NOT] 改 `readTemplateListFromFile` / `resolveTemplateConfigPath` 的本地解析语义。
- [MUST NOT] 引入 MCP 服务启动期 configPath 注入（用户改用"取资源时传入"，本期不做启动参数口子）。
- [MUST NOT] 做单模板详情资源、资源订阅、模板内容预览等增强。
- [MUST NOT] 触碰本次 review 发现的安全问题（模板 RCE / shell 注入 / publish reset --hard）——另立任务。

## AI 自由度警戒线
- [MUST NOT] 自行恢复或新增 handler 内的 mcp/cli mode 分叉（与 REQ-4 冲突）。
- [MUST NOT] 让 MCP 任一路径联网或读家目录全局指针。
- [MUST NOT] 改动 prepare/complete 既有 envData/draft 协议语义。
- 资源 URI 方案 / prompt 参数集 [MUST] 在设计阶段定稿并经设计审核，[MUST NOT] 实施时随意改。

## 验收标准汇总（可观察）
1. MCP 暴露：Resources(模板列表，参数化 configPath) + Tools(prepare/complete) + Prompts(引导) 三类齐全。
2. 资源读取只读本地、不联网、不读全局/远程。
3. prepare 缺 templateUrl 被 zod 拦；MCP 不触达 getTemplateList。
4. handler 内无 mcp/cli 分叉（guard 已回退）。
5. CLI 流程与既有 8 个测试不回归；新测试覆盖资源/工具/prompt。
6. build + lint + vitest 全绿。
