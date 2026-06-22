/**
 * jsonMerge op（Wave B3，design §6 / §14 D-H8 / D-L1 / D-L4）。
 *
 * effect=merge-structured，conflictKey 可空；apply 读 base(vfs 现有 target)+patch(source，.json
 * only D-L1)→ Wave A jsonMerge → 回填 Conflict 的 file/opId/source（Wave A 用 ""/占位）→
 * assertNoConflict throw → stringifyJsonDeterministic（探测 base 风格，不全局排序 key，D-H2/D-H8）写回。
 */
import type {
  AssembleOp,
  Conflict,
  JsonMergeOp,
  OpContext,
  OpHandler,
  OpResult,
  TargetEffect,
  WriteProvenance,
} from "../types";
import {
  detectJsonStyle,
  jsonMerge,
  stringifyJsonDeterministic,
} from "../json-merge";
import { assertNoConflicts } from "../conflict";

const narrow = (op: AssembleOp): JsonMergeOp => op as unknown as JsonMergeOp;

const requireJson = (p: string, label: string): void => {
  if (!p.endsWith(".json")) {
    throw new Error(`jsonMerge ${label} [MUST] 为 .json：${p}（D-L1）`);
  }
};

/**
 * 回填 Wave A 占位的 file + 两侧 provenance（M2，D-L4 segment 级）。
 * Wave A 留 sides=[base 占位, patch 占位]（opId ""，source 各填 baseSource/patchSource）：
 *  - base 侧（idx 0）opId 取 base 节点既有 provenance.lastOpId（前序贡献者），缺则标 "(base)"；
 *  - patch 侧（idx 1）opId 取当前 op，source 缺省补当前 op.source。
 * [MUST] 两侧来源不同——诊断需指出「哪两块 op」冲突，而非都写当前 op。
 */
const enrichConflicts = (
  conflicts: Conflict[],
  arg: {
    target: string;
    opId: string;
    source?: string;
    baseProvenance?: WriteProvenance;
  },
): Conflict[] =>
  conflicts.map((c) => ({
    ...c,
    file: arg.target,
    sides: c.sides.map((s, idx) =>
      idx === 0
        ? { opId: arg.baseProvenance?.lastOpId ?? "(base)", source: s.source }
        : { opId: arg.opId, source: s.source ?? arg.source },
    ),
  }));

export const jsonMergeHandler: OpHandler = {
  effects(op: AssembleOp): TargetEffect[] {
    return [
      {
        target: op.target,
        kind: "merge-structured",
        category: "content-model",
        createsTarget: true,
      },
    ];
  },

  preflight(_ctx, op: AssembleOp): void {
    const o = narrow(op);
    requireJson(o.target, "target");
    requireJson(o.source, "source");
  },

  /** M3：plan 期 dry-merge 只读预检——读 base(dry VFS)+patch(fragment) 试合并，冲突即 fail-loud。 */
  preflightApply(ctx: OpContext, op: AssembleOp): void {
    runMerge(ctx, narrow(op)); // 仅校验冲突，丢弃 result，不写 VFS
  },

  apply(ctx: OpContext, op: AssembleOp): OpResult {
    const o = narrow(op);
    const { result, style } = runMerge(ctx, o);
    const out = stringifyJsonDeterministic(result, {
      indent: style.indent,
      eol: style.eol,
    });
    ctx.vfs.setFile(o.target, Buffer.from(out, "utf-8"), o.id);
    return { changed: true, conflicts: [] };
  },
};

/**
 * 纯合并 + 冲突 fail-loud（不写 VFS）；apply / preflightApply 共用。
 * base 来自当前 VFS（dry 或执行），patch 来自 fragment。冲突 provenance 两侧分别填
 * base 节点既有来源 + 当前 op（M2）。
 */
const runMerge = (
  ctx: OpContext,
  o: JsonMergeOp,
): { result: unknown; style: ReturnType<typeof detectJsonStyle> } => {
  requireJson(o.target, "target");
  requireJson(o.source, "source");

  const baseNode = ctx.vfs.get(o.target);
  const baseText =
    baseNode && baseNode.kind === "file" && baseNode.content
      ? baseNode.content.toString("utf-8")
      : "{}";
  const style = detectJsonStyle(baseText);
  const base = JSON.parse(baseText) as unknown;

  const patchText = ctx.readFragment(o.source);
  const patch = JSON.parse(patchText) as unknown;

  const { result, conflicts } = jsonMerge(base, patch, {
    recipeId: ctx.recipe.id,
    baseSource: o.target,
    patchSource: o.source,
    fieldPolicy: o.fieldPolicy,
  });
  assertNoConflicts(
    enrichConflicts(conflicts, {
      target: o.target,
      opId: o.id,
      source: o.source,
      baseProvenance: baseNode?.provenance,
    }),
  );
  return { result, style };
};
