export {
  handler,
  compileHandler,
  batchCompileHandler,
  normalizeCollectEnvDataForm,
} from "@/handlers";
export type { CollectEnvDataQuestion } from "@/handlers";
export { createAsSubcommand } from "./main";
export * from "@/types";
export * from "@/utils/path";
export { getConfigPath } from "@/utils/config";
// generator M2：remove dry-run 预检复用引擎同款归一化（dealMarkdown 剥 fence + inputData/input 同源）
export { getData } from "@/utils/get-data";
// P2：INSERT marker 工具（generator remove dry-run 预检复用 + assemble[P4a] 可用）
export {
  DEFAULT_MARKER_NS,
  resolveMarkerComment,
  validateMarkerKey,
  buildMarkerLines,
  computeInsert,
  computeRollback,
  detectEol,
  probeMarkerPairing,
} from "@/utils/marker";
