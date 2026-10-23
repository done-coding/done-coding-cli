/**
 * writeFile op（T1 codegen-unified；内联字面内容原样落盘）。
 *
 * effect=write-whole（createsTarget + replacesWhole，与 addFragment 同属整文件铺底基层）；
 * apply = vfs.setFile(target, Buffer.from(content,"utf-8"), op.id)。
 *  - content 原样落盘：不渲染、不改 EOL（字面即终值，与 addFragment raw 语义一致）。
 *  - 存在性守卫复用 add-fragment 导出的 guardIfExists（DRY，第 2 次出现不复制，逻辑零改）：
 *    ifExists 默认 error、显式 keep 保留既有（D-M5）。
 *  - preflight：目标路径词法形状守卫（见下）。
 */
import path from "node:path";
import type {
  AssembleOp,
  OpContext,
  OpHandler,
  OpResult,
  PlanContext,
  TargetEffect,
  WriteFileOp,
} from "../types";
import { guardIfExists } from "./add-fragment";

const narrow = (op: AssembleOp): WriteFileOp => op as unknown as WriteFileOp;

export const writeFileHandler: OpHandler = {
  effects(op: AssembleOp): TargetEffect[] {
    return [
      {
        target: op.target,
        kind: "write-whole",
        category: "content-model",
        createsTarget: true,
        // 整文件铺底（不解释格式）：与至多一个格式编辑模型可叠加，不计入混族互斥（同 addFragment）。
        replacesWhole: true,
      },
    ];
  },

  preflight(ctx: PlanContext, op: AssembleOp): void {
    const o = narrow(op);
    // 权威 output 边界由 engine assertOutputInside(ctx.cwd) 守；本 op 只做目标路径词法形状守卫
    // （无 resolve → 无 cwd 基准 → 子目录调用不可能被误导）。
    // 拒：绝对路径 / 任一路径段为 `..`（按 `/`、`\` 切分）。
    if (path.isAbsolute(o.target)) {
      throw new Error(
        `writeFile 目标越界：${o.target}（绝对路径，[MUST] 产物根相对路径）`,
      );
    }
    for (const seg of o.target.split(/[\\/]/)) {
      if (seg === "..") {
        throw new Error(
          `writeFile 目标越界：${o.target}（含 .. 段，禁止逃逸产物根）`,
        );
      }
    }
  },

  apply(ctx: OpContext, op: AssembleOp): OpResult {
    const o = narrow(op);
    if (!guardIfExists(ctx, o, o.target)) {
      return { changed: false, conflicts: [] };
    }
    ctx.vfs.setFile(o.target, Buffer.from(o.content, "utf-8"), o.id);
    return { changed: true, conflicts: [] };
  },
};
