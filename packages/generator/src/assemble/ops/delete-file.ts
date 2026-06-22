/**
 * deleteFile op（Wave B3，design §4.3 / §14 D-H5）。
 *
 * effect=delete-file；apply 按**当前 VFS** 判：不存在 throw（删不存在 fail，D-H5/C5）；
 * 存在则删。**写后删 / 删后重建** 的顺序语义由 planner 顺序模拟判（B4），op 自身只管
 * 当前态删除 + 读 allowDiscard（planner 据此标记）。
 */
import type {
  AssembleOp,
  DeleteFileOp,
  OpContext,
  OpHandler,
  OpResult,
  TargetEffect,
} from "../types";

const narrow = (op: AssembleOp): DeleteFileOp => op as unknown as DeleteFileOp;

export const deleteFileHandler: OpHandler = {
  effects(op: AssembleOp): TargetEffect[] {
    return [
      {
        target: op.target,
        kind: "delete-file",
        category: "delete",
        removesTarget: true,
      },
    ];
  },

  apply(ctx: OpContext, op: AssembleOp): OpResult {
    const o = narrow(op);
    if (!ctx.vfs.has(o.target)) {
      throw new Error(
        `deleteFile 目标不存在于当前 VFS：${o.target}（删不存在 fail，D-H5/C5）`,
      );
    }
    ctx.vfs.delete(o.target);
    return { changed: true, conflicts: [] };
  },
};
