/**
 * deleteField op（Wave B3，design §3.1 / §14 D-H5 / C5 / D-L1）。
 *
 * effect=delete-field，conflictKey=pointer；apply 读 target(.json)→ Wave A deleteByPointer
 * （不存在 throw）→ stringifyJsonDeterministic 写回（探测 base 风格，不全局排序 key）。
 */
import type {
  AssembleOp,
  DeleteFieldOp,
  OpContext,
  OpHandler,
  OpResult,
  PlanContext,
  TargetEffect,
} from "../types";
import { deleteByPointer } from "../json-pointer";
import { detectJsonStyle, stringifyJsonDeterministic } from "../json-merge";

const narrow = (op: AssembleOp): DeleteFieldOp =>
  op as unknown as DeleteFieldOp;

const requireJsonTarget = (target: string): void => {
  if (!target.endsWith(".json")) {
    throw new Error(`deleteField target [MUST] 为 .json：${target}（D-L1）`);
  }
};

/** 宽松解析：内容非合法 JSON（如计划期空占位）返回 undefined，交由 apply 真判。 */
const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const readJsonNode = (ctx: PlanContext, target: string): string => {
  const node = ctx.vfs.get(target);
  if (!node || node.kind !== "file" || !node.content) {
    throw new Error(`deleteField target 不存在于 VFS：${target}（C5）`);
  }
  return node.content.toString("utf-8");
};

export const deleteFieldHandler: OpHandler = {
  effects(op: AssembleOp): TargetEffect[] {
    const o = narrow(op);
    // category=metadata：delete-field 是对「已成形 json」的字段级裁剪，与 jsonMerge
    // (merge-structured) 共存合法（design §3.1 line 116 canonical 例：jsonMerge + deleteField
    // 同 package.json）。故不计入 whole-content 互斥，但保 conflictKey=pointer 做重复删检测。
    return [
      {
        target: o.target,
        kind: "delete-field",
        category: "metadata",
        conflictKey: o.pointer,
      },
    ];
  },

  preflight(ctx: PlanContext, op: AssembleOp): void {
    const o = narrow(op);
    requireJsonTarget(o.target);
    // 计划期 best-effort：目标须在当前模拟 VFS（不存在 fail，C5）。
    // pointer 存在性须真实内容才能判——若模拟态内容可解析则提前判，否则推迟到 apply。
    const node = ctx.vfs.get(o.target);
    if (!node || node.kind !== "file") {
      throw new Error(`deleteField target 不存在于 VFS：${o.target}（C5）`);
    }
    const text = node.content?.toString("utf-8") ?? "";
    const obj = tryParseJson(text);
    if (obj === undefined) return; // 模拟态无真实内容（前序 op 产出），推迟到 apply
    deleteByPointer(obj, o.pointer); // pointer 不存在 → throw（dry，丢弃结果）
  },

  apply(ctx: OpContext, op: AssembleOp): OpResult {
    const o = narrow(op);
    requireJsonTarget(o.target);
    const text = readJsonNode(ctx, o.target);
    const style = detectJsonStyle(text);
    const obj = JSON.parse(text) as unknown;
    deleteByPointer(obj, o.pointer); // 不存在 throw（C5）
    const out = stringifyJsonDeterministic(obj, {
      indent: style.indent,
      eol: style.eol,
    });
    ctx.vfs.setFile(o.target, Buffer.from(out, "utf-8"), o.id);
    return { changed: true, conflicts: [] };
  },
};
