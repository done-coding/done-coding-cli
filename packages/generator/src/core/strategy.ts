/**
 * [T3 骨架] 由 Wave B T4 实现 <strategyRegistry：对外 strategy → 引擎 OutputMode 映射>。
 *
 * 职责（design §4.3/§10）：表驱动 create→OVERWRITE / append→APPEND / replace→REPLACE /
 * inject→INSERT（P2），标注 supportsRollback。
 * 扩展缝：加 strategy = 注册一条 + （需要时）引擎加 handler。
 */
import { OutputModeEnum } from "@done-coding/cli-template";
import type { Strategy, StrategyDescriptor, StrategyRegistry } from "@/types";

/**
 * strategyRegistry（4 条）。
 *  - create  → OVERWRITE，supportsRollback: true（删文件）
 *  - append  → APPEND，   supportsRollback: true（命中检测后删块）
 *  - replace → REPLACE，  supportsRollback: false（引擎已挡 + generator fail-loud）
 *  - inject  → INSERT，   supportsRollback: true（marker 精确回退，P2）
 */
export const strategyRegistry: StrategyRegistry = {
  create: { mode: OutputModeEnum.OVERWRITE, supportsRollback: true },
  append: { mode: OutputModeEnum.APPEND, supportsRollback: true },
  replace: { mode: OutputModeEnum.REPLACE, supportsRollback: false },
  inject: { mode: OutputModeEnum.INSERT, supportsRollback: true },
};

/** 默认 strategy（缺省 = create，design §3.1） */
export const DEFAULT_STRATEGY: Strategy = "create";

/** 解析 strategy 描述符（缺省回落 create）；未知 strategy fail-fast */
export const resolveStrategy = (strategy?: Strategy): StrategyDescriptor => {
  const resolved = strategy ?? DEFAULT_STRATEGY;
  const descriptor = strategyRegistry[resolved];
  if (!descriptor) {
    throw new Error(
      `未知落地策略「${resolved}」：仅支持 ${Object.keys(strategyRegistry).join(
        " / ",
      )}`,
    );
  }
  return descriptor;
};
