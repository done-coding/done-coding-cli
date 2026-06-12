---
任务等级: Moderate
日期: 2026-06-11
关联: requirements.md / design.md / tasks.md（均已完成）
---

# 复盘：create-mcp 三原语 + 模板来源结构性隔离

## 目标达成
create-mcp 从「仅 3 个 Tool」升级为完整三原语：
- **Resource** `done-coding-create-template-list://{+configPath}`（参数化，取资源时传本地 configPath，仅本地不联网）。
- **Tools** prepare（templateUrl 改 zod 必填）/ complete；移除 `done_coding_list_create_templates`。
- **Prompt** `create-done-coding-project`（引导 资源→prepare→complete）。
- 隔离机制由「运行时 mode 闸」重构为「zod 结构边界」：回退 commit `4fd5b0e`，CLI handler 内不再有 mcp/cli 分叉。

## 验收证据
- build 4/4；eslint create+mcp EXIT 0；create vitest 9/9（6 e2e 不回归 + 3 资源核心）；mcp vitest 3/3；注册 smoke 通过。

## 做对的
1. **先验证高风险设计点再写实现**：design §1 把 `{+configPath}` round-trip 标为 MUST-验证。实施前先用一次性 node 脚本核 SDK `UriTemplate`，确认 reserved expansion 对绝对路径 round-trip=true，三个候选方案一次定主方案，避免写完才发现要回退。该验证后固化为 mcp 测试。
2. **隔离边界结构化**：把"靠运行时 if 判 mode"换成"靠 zod schema 必填字段"，隔离从可被绕过的运行时检查上移为类型/校验边界；并在代码注释 + README 诚实标注「编程式直调绕过 zod 时无隔离」，不夸大保证。
3. **资源回调纯函数化**：将 readCallback 主体抽成 `readTemplateListResource` 导出，资源逻辑可在 create 包既有 vitest 设施内单测，无需起 stdio server。

## 摩擦点 / 教训
1. **eslint 默认仅 lint `.js`**：`pnpm eslint src test` 对纯 `.ts` 目录报 "No files matching the pattern test"，需 `--ext .ts`。后续 lint 命令统一带 `--ext .ts`。
2. **测试归属随依赖方向走**：prepare zod schema 与 SDK `UriTemplate` 属 mcp 层（依赖 SDK），资源核心属 create 层。强行全塞 create 测试会变成测副本（弱断言）。最终按依赖边界拆成两处真测，并给 mcp 包补了最小 vitest（alias `@`→src，直测 src 无需先 build 本包）。
3. **Read-before-Edit 纪律**：用 Bash `cat` 看过的文件，Edit 仍要求先用 Read 工具读过——`cat` 不计入 harness 的文件状态。两处 Edit 因此先失败再补 Read。

## 沉淀（可复用）
- 高风险/不确定的 SDK 行为：实现前先写一次性探针脚本验证，再把结论固化成测试。
- 隔离/安全边界优先用「结构性约束（schema/类型）」而非「运行时分支判断」，并诚实标注其适用范围。
