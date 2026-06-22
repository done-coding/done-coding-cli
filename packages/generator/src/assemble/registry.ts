/**
 * op handler registry（Wave B2，design §4.2 / §14 D-H3）。
 *
 *  - 能力声明式（OpHandler = {effects, preflight?, apply}），planner/engine 一视同仁。
 *  - registerOp / resolveOp（未知 throw 并列已注册，C3）/ listOps。
 *  - registerBuiltinOps：显式装配 5 内建（add-fragment/text-patch/json-merge/
 *    delete-file/delete-field），engine 启动调一次——「新增 op = 注册一条、planner/engine 零改」。
 *
 * [MUST NOT] 在 planner/engine 出现 `if op.type==="deleteFile"` 这类特判（A-NFR-4 命脉，D-H3）。
 */
import type { OpHandler } from "./types";
import { addFragmentHandler } from "./ops/add-fragment";
import { textPatchHandler } from "./ops/text-patch";
import { jsonMergeHandler } from "./ops/json-merge-op";
import { deleteFileHandler } from "./ops/delete-file";
import { deleteFieldHandler } from "./ops/delete-field";

/** 模块级 registry（同 realm 单例；测试可经 unregisterAll 清场） */
const registry = new Map<string, OpHandler>();

/** 注册一个 op handler（重复 type 覆盖——扩展口语义，A-NFR-4）。 */
export const registerOp = (type: string, handler: OpHandler): void => {
  registry.set(type, handler);
};

/** 解析 op handler；未知 type → throw 并列已注册（C3）。 */
export const resolveOp = (type: string): OpHandler => {
  const handler = registry.get(type);
  if (!handler) {
    const known = listOps();
    throw new Error(
      `未知 op type「${type}」（registry 未注册）。已注册：${
        known.length ? known.join(", ") : "(空)"
      }`,
    );
  }
  return handler;
};

/** 列出已注册 type（字典序，确定性）。 */
export const listOps = (): string[] => [...registry.keys()].sort();

/** 是否已注册某 type。 */
export const hasOp = (type: string): boolean => registry.has(type);

/** 清空 registry（测试隔离用）。 */
export const unregisterAll = (): void => registry.clear();

/** 内建 5 op 的 type → handler 映射（显式装配，零 import 副作用）。 */
const BUILTIN_OPS: Record<string, OpHandler> = {
  addFragment: addFragmentHandler,
  textPatch: textPatchHandler,
  jsonMerge: jsonMergeHandler,
  deleteFile: deleteFileHandler,
  deleteField: deleteFieldHandler,
};

/** 显式装配 5 内建 op（engine 启动调一次；幂等）。 */
export const registerBuiltinOps = (): void => {
  for (const [type, handler] of Object.entries(BUILTIN_OPS)) {
    registerOp(type, handler);
  }
};
