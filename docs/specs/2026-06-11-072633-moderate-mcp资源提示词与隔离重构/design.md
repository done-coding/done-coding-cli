---
任务等级: Moderate
审核状态: 已通过（PM 轻量自审对照 requirements；reviewer=PM；无重大未决——URI {+} 方案带验证项落到 T3/T7 测试，非阻塞）
日期: 2026-06-11
关联: requirements.md（已通过）
---

# 设计：create-mcp 三原语 + 模板来源结构性隔离

> 自包含设计定稿，供压缩后续做。所有 SDK 签名、文件落点、隔离推理已固化，续做[MUST NOT]再重查 SDK。

## 0. 已确认的 SDK 事实（@modelcontextprotocol/sdk@1.29.0，勿重查）
- `server.registerResource(name, template: ResourceTemplate, config: ResourceMetadata, readCallback: ReadResourceTemplateCallback)`。
  - `ResourceTemplate` 构造：`new ResourceTemplate(uriTemplate: string, { list: undefined })`（list 回调可不提供）。
  - `ReadResourceTemplateCallback = (uri: URL, variables: Variables, extra) => ReadResourceResult`。`variables.<name>` = URI 模板解析出的参数。
  - `ResourceMetadata = { title?, description?, mimeType? }`。
  - `ReadResourceResult` = `{ contents: [{ uri: string, mimeType?: string, text?: string }] }`。
- `server.registerPrompt(name, { title?, description?, argsSchema? }, cb: PromptCallback)`；
  - `PromptCallback(args, extra) => GetPromptResult`；`GetPromptResult = { messages: [{ role: "user"|"assistant", content: { type: "text", text: string } }] }`。
  - argsSchema 形如 `{ configPath: z.string()... }`（PromptArgsRawShape = 命名 zod）。
- `server.registerTool(name, { title, description, inputSchema }, cb)`（现有用法，沿用）。

## 1. 资源（REQ-1）
**注册一个参数化资源**（`mcp/src/handlers/create.ts`，在 `registerCreateTools` 内或新函数 `registerCreateResources`）：
- name：`done-coding-create-template-list`
- URI 模板：`done-coding-create-template-list://{+configPath}`
  - **设计风险[MUST 验证]**：`{+configPath}` 用 RFC6570 reserved expansion 以保留绝对路径里的 `/`。实施时[MUST]写测试核 SDK 的 `UriTemplate` 是否支持 `{+}` 且能正确解析回原始绝对路径。
  - **回退方案**：若 `{+}` 不被支持/不能正确 round-trip → 改用 `done-coding-create-template-list://list?configPath={configPath}` 或要求传入百分号编码路径并在回调里 `decodeURIComponent`。最终以"测试能用真实绝对路径 round-trip"为准。
- readCallback：
  ```ts
  async (uri, variables) => {
    const configPath = String(variables.configPath ?? "");
    if (!configPath) {
      // 不静默联网/不回落：返回明确错误内容
      throw new Error("读取模板列表资源需要本地 configPath（绝对路径）");
    }
    const templateList = await readTemplateListFromFile(configPath); // 本地、不联网、缺失→[]
    return { contents: [{ uri: uri.href, mimeType: "application/json",
      text: JSON.stringify({ source: "local", configPath, templateList }, null, 2) }] };
  }
  ```
- config：`{ title: "done-coding create 模板列表", description: "从本地 configPath 指向的 {templateList:[...]} 读取可选模板，仅本地不联网", mimeType: "application/json" }`
- **不联网/不读全局/不读远程**：只调 `readTemplateListFromFile`（已是纯本地）。[MUST NOT] 调 `resolveTemplateConfigPath`（那会读家目录指针）。

## 2. 工具（REQ-2）
- **移除** `done_coding_list_create_templates`（删整段 registerTool + 不再 import 仅它用到的符号）。其职责由 §1 资源取代。
- **prepare**：`prepareInputSchema` 的 `templateUrl` 由 `z.string().optional()` → **`z.string()`（必填）**。其余字段不变。描述保留"templateUrl 来自模板列表资源；MCP 不回落全局/远程/不联网"。
- **complete**：不变。
- 影响 import：`readTemplateListFromFile` 现改由资源回调使用（仍 import）；确认无未用 import 残留。

## 3. 提示词（REQ-3）
**注册引导 Prompt**（`mcp/src/handlers/create.ts`，`registerCreatePrompts`）：
- name：`create-done-coding-project`
- argsSchema：`{ configPath: z.string().describe("本地模板列表配置文件绝对路径"), projectName: z.string().optional() }`
- 回调返回 GetPromptResult.messages（user role 文本），引导步骤：
  1. 读取资源 `done-coding-create-template-list://{configPath}` 查看可选模板；
  2. 选定后取其 `url` 作为 `templateUrl` 调 `done_coding_prepare_create_project`（带 projectName）；
  3. 若返回 `need_input`，按 `questions` 收集答案作为 `envData` 调 `done_coding_complete_create_project`（带 draftId）；
  4. 强调：MCP 不读全局/远程、不联网。

## 4. 隔离回退（REQ-4）—— 删 mode 闸，靠 zod 结构边界
- **回退** `create/src/handlers/create.ts` `resolveTemplateSourceInfo` 内 commit `4fd5b0e` 加的这段（删除）：
  ```ts
  const ctx = resolveHandlerContext(ctxInit);
  if (ctx.mode === "mcp") { throw new Error("MCP 模式下必须经 list 工具..."); }
  ```
  注意：删后若 `resolveHandlerContext` 在该函数内不再被用到，[MUST]同时清理该行 import/调用残留（`resolveHandlerContext` 在 create.ts 别处仍用，import 保留）。
- 隔离新机制（结构性）：prepare 工具 `templateUrl` zod 必填 ⇒ MCP 运行时永远带 templateUrl 进 `resolveTemplateSourceInfo` ⇒ 走 `if (!templateUrl)` 之外的分支 ⇒ 永不进 `getTemplateForm/getTemplateList` ⇒ 不读全局/远程、不联网。
- **诚实边界（写入代码注释 + README）**：导出函数 `prepareCreateProject` 直接被编程式调用（绕过 MCP 工具 zod）时无 mode 隔离；MCP 运行时唯一入口是 zod-guarded prepare 工具，故运行时保证成立。CLI handler 无 mcp/cli 分叉。

## 5. 文件落点汇总
| 文件 | 改动 |
|---|---|
| `packages/mcp/src/handlers/create.ts` | 删 list 工具；prepare templateUrl 必填；加资源注册 + 加 prompt 注册 |
| `packages/create/src/handlers/create.ts` | 回退 `4fd5b0e` 的 mode 闸（删那 6 行） |
| `packages/create/test/mcp-template-isolation.test.ts` | 改造：不再测 guard 抛错；改测 prepare zod 必填 templateUrl + 资源只读本地 |
| `packages/create/README.md` | MCP 小节更新为资源+prompt+prepare 必填新形态 |
| （可选）`packages/mcp/` 测试 | 若加 mcp 包级测试覆盖资源/prompt |

## 6. 测试设计（REQ-5）
- **prepare zod 必填**：构造 `prepareInputSchema`（或从 mcp 导出/复制 schema 形状）`.safeParse({projectName,...})` 缺 templateUrl → success=false。[MUST]验证缺 templateUrl 被拦。
- **资源回调**：直接调资源 readCallback（或经 server）传一个本地 `{templateList:[...]}` configPath → 返回该列表 JSON；configPath 空 → 抛错/错误内容；指向不存在 → templateList=[]（无网络）。
- **URI round-trip**：用真实绝对路径核 `{+configPath}` 能解析回原值（验证 §1 设计风险）。
- **e2e 6 用例不回归**：`noninteractive.e2e.test.ts` 保持通过。
- 测试落点：优先 `packages/create/test/`（已有 vitest 设施）；若需直接测 mcp 注册，给 `packages/mcp/` 加最小 vitest（装 vitest devDep）。倾向：schema 与资源回调逻辑尽量做成可单测的纯函数/导出，避免起 server。
  - 实施提示：可把资源 readCallback 主体抽成纯函数 `readTemplateListResource(configPath)` 导出，单测它 + prepare schema，避免起 stdio server。

## 7. 验证命令
- `npx lerna run build --scope=@done-coding/cli-utils --scope=@done-coding/cli-template --scope=create-done-coding --scope=@done-coding/cli-mcp`
- `cd packages/create && pnpm eslint src test`；`cd packages/mcp && pnpm eslint src`
- `pnpm --filter create-done-coding test`（+ 若加 mcp 测试 `pnpm --filter @done-coding/cli-mcp test`）

## 8. 设计审核五步（执行落地期内部审，[MUST NOT] 用户亲审）
架构师产出本 design → reviewer 自检（URI 方案/隔离推理/测试可行性）→ 上下游预审（开发可实施性、测试可验证性）→ PM 整合 → frontmatter `审核状态` 标"已通过"。续做时若 design 已是"已通过"则直接进实施。
