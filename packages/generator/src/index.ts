/**
 * [T3 骨架] @done-coding/cli-generator 公共出口。
 *
 * 导出 handler / 类型 / 核心原语，供：
 *  - dc-component 薄兼容包装（T7，batchType 固定 component）；
 *  - [P3] cli-mcp 注册 dc-generator 工具（server-agnostic handler 直接 import）；
 *  - [P4a] assemble 复用 batch-discovery / env-context / strategy / operate 原语。
 */

// handlers（命令面，T5 填充实现）
export {
  addHandler,
  modifyHandler,
  removeHandler,
  listHandler,
  initHandler,
  assembleHandler,
  commandCliInfo,
  buildBatchQuestions,
} from "@/handlers";
export type { BatchQuestion, AssembleHandlerResult } from "@/handlers";
export { createCommand, createAsSubcommand } from "./main";

// ───────────────────────── assemble 公共契约（P4a，编程式复用 + 测试） ─────────────────────────
export {
  loadRecipe,
  validateRecipe,
  discoverRecipes,
  recipeDir,
  fragmentRoot,
} from "@/assemble/recipe";
export {
  runPlan,
  runBuild,
  runDiff,
  assertOutputsCompatible,
  isGitPathClean,
  type EngineCtx,
  type BuildOptions,
  type BuildResult,
  type DiffOptions,
  type DriftEntry,
  type DriftResult,
} from "@/assemble/engine";
export { syncCreateTemplate, type SyncResult } from "@/assemble/create-sync";
export {
  registerOp,
  resolveOp,
  registerBuiltinOps,
  listOps,
} from "@/assemble/registry";
export { plan, type ExecutionPlan, type PlanItem } from "@/assemble/planner";
export {
  createVfs,
  loadBaseDir,
  flush,
  readManifest,
  writeManifest,
} from "@/assemble/vfs";
export { createRender, readFragment } from "@/assemble/render";
export { jsonMerge, stringifyJsonDeterministic } from "@/assemble/json-merge";
export { getByPointer, deleteByPointer } from "@/assemble/json-pointer";
// assemble 类型契约（Recipe/AssembleOp/OpHandler/Conflict/Manifest 等）
export * from "@/assemble/types";

// 核心原语（T4 填充实现，供 [P4a] assemble 复用）
export {
  discoverBatch,
  readBatchConfig,
  listDiscoveredBatches,
} from "@/core/batch-discovery";
export { createEnvContext, createEnvHelpers } from "@/core/env-context";
export {
  strategyRegistry,
  resolveStrategy,
  DEFAULT_STRATEGY,
} from "@/core/strategy";
export { operate } from "@/core/operate";
export {
  resolveInstanceDir,
  removeEmptyInstanceDir,
} from "@/core/instance-dir";

// 工具
export { ensureNameLegal, NAME_LEGAL_PATTERN } from "@/utils/ensure-name";

// 类型契约（权威，Wave B/P2/P3/P4a 共享）
export * from "@/types";
