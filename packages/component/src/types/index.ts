/**
 * [T7] dc-component 退化为 cli-generator 的 component 预设后，本包不再持有业务类型。
 *
 * - `SubcommandEnum`：dc-component 命令面仍用（add/remove/list），保留。
 * - 其余批次 / 渲染 / config 类型一律改为从 @done-coding/cli-generator 兼容 re-export，
 *   避免下游（如有）继续 import 旧类型时断裂。
 *
 * 仓内核实：外部仅 packages/cli 依赖本包的 `handler` / `createAsSubcommand`（值），
 * 未 import 本包类型；旧 Config/TemplateConfig/ConfigListItem 等随旧 JS 逻辑一并下线。
 */

/** 子命令枚举（dc-component 命令面：add/remove/list/modify） */
export enum SubcommandEnum {
  /** 新增组件 */
  ADD = "add",
  /** 移除组件 */
  REMOVE = "remove",
  /** 展示列表 */
  LIST = "list",
  /** 原位修改 inject 块 */
  MODIFY = "modify",
}

// 兼容 re-export：批次 / 渲染 / config 权威类型现由 generator 持有（content-free）
export type {
  BatchConfig,
  FileEntry,
  Strategy,
  EnvContext,
  ListSerializerConfig,
  GeneratorHandlerArgv,
} from "@done-coding/cli-generator";
