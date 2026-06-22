/**
 * textPatch op（Wave B3，design §5 / §14 D-M4 / D-L4）。
 *
 * effect=patch-region，conflictKey=markerKey（缺省 op.id）。apply 复用 P2 marker 纯函数
 * （computeInsert/computeRollback/resolveMarkerComment/validateMarkerKey/buildMarkerLines）。
 *  - assemble 层在调用 computeInsert 前**自查锚点命中数 > 1 默认 fail（D-M4）**，仅
 *    anchorMatch:"first" 降级——[MUST NOT] 改 P2 marker 源码。
 *  - direction insert（默认，computeInsert）/ remove（裁剪，computeRollback）。
 */
import type {
  AssembleOp,
  InsertAnchor,
  OpContext,
  OpHandler,
  OpResult,
  PlanContext,
  TargetEffect,
  TextPatchOp,
} from "../types";
import {
  buildMarkerLines,
  computeInsert,
  computeRollback,
  resolveMarkerComment,
  validateMarkerKey,
} from "@done-coding/cli-template";
import { getMarkerNs } from "@/core/marker-ns";

const narrow = (op: AssembleOp): TextPatchOp => op as unknown as TextPatchOp;

/** conflictKey = markerKey（缺省 op.id） */
const conflictKeyOf = (op: TextPatchOp): string => op.markerKey ?? op.id;

/** CRLF/CR → LF 规范化（M4 / D-H2，插入文本默认统一 LF）。 */
const normalizeEol = (text: string): string => text.replace(/\r\n?/g, "\n");

/** 读取目标现内容（不存在视为空串，允许向新文件插入）。 */
const readTarget = (ctx: PlanContext, target: string): string => {
  const node = ctx.vfs.get(target);
  if (node && node.kind === "file" && node.content) {
    return node.content.toString("utf-8");
  }
  return "";
};

/** assemble 层锚点匹配（同 P2 compileAnchor 语义：literal includes / regex test）。 */
const lineMatcher = (anchor: InsertAnchor): ((line: string) => boolean) => {
  if ((anchor.patternType ?? "literal") === "regex") {
    const re = new RegExp(anchor.pattern);
    return (line: string): boolean => re.test(line);
  }
  return (line: string): boolean => line.includes(anchor.pattern);
};

/**
 * D-M4 锚点多命中守卫：命中数 > 1 默认 fail，仅 anchorMatch:"first" 降级。
 * 仅在「新文件 / 无既有成对块」即将按 anchor 插入时有意义；既有块原位替换不走 anchor。
 */
const assertAnchorUnique = (content: string, op: TextPatchOp): void => {
  if (!op.anchor) return;
  if (op.anchorMatch === "first") return;
  const match = lineMatcher(op.anchor);
  const count = content.split(/\r?\n/).filter(match).length;
  if (count > 1) {
    throw new Error(
      `textPatch 锚点多命中（${count}）默认 fail：${op.target} pattern「${op.anchor.pattern}」。` +
        `如确需取首个，显式设 anchorMatch:"first"（D-M4）。`,
    );
  }
};

/** 既有文件是否已存在该 markerKey 的成对块（成对则走原位替换，不触发 anchor 多命中守卫）。 */
const hasExistingBlock = (content: string, op: TextPatchOp): boolean => {
  const comment = resolveMarkerComment(op.target, op.markerComment);
  const key = validateMarkerKey(
    conflictKeyOf(op),
    comment,
    op.target,
    getMarkerNs(),
  );
  const { startLine, endLine } = buildMarkerLines(comment, key, getMarkerNs());
  const lines = content.split(/\r?\n/);
  return lines.includes(startLine) && lines.includes(endLine);
};

const applyInsert = (ctx: OpContext, op: TextPatchOp): OpResult => {
  const content = readTarget(ctx, op.target);
  // 既有成对块 → 原位替换（幂等），不做 anchor 多命中守卫
  if (!hasExistingBlock(content, op)) {
    assertAnchorUnique(content, op);
  }
  const comment = resolveMarkerComment(op.target, op.markerComment);
  const rendered = normalizeEol(ctx.render(ctx.readFragment(op.source)));
  const next = computeInsert(content, rendered, {
    comment,
    markerKey: conflictKeyOf(op),
    markerNs: getMarkerNs(),
    anchor: op.anchor,
    outputPath: op.target,
  });
  ctx.vfs.setFile(op.target, Buffer.from(next, "utf-8"), op.id);
  return { changed: true, conflicts: [] };
};

const applyRemove = (ctx: OpContext, op: TextPatchOp): OpResult => {
  const content = readTarget(ctx, op.target);
  const comment = resolveMarkerComment(op.target, op.markerComment);
  const next = computeRollback(content, {
    comment,
    markerKey: conflictKeyOf(op),
    markerNs: getMarkerNs(),
    outputPath: op.target,
  });
  ctx.vfs.setFile(op.target, Buffer.from(next, "utf-8"), op.id);
  return { changed: true, conflicts: [] };
};

export const textPatchHandler: OpHandler = {
  effects(op: AssembleOp): TargetEffect[] {
    const o = narrow(op);
    // insert 可作用于新文件（向不存在 target 插入即创建）→ createsTarget 参与顺序模拟首次落盘；
    // remove（裁剪）只改既有文件，不创建。
    const creates = (o.direction ?? "insert") === "insert";
    return [
      {
        target: o.target,
        kind: "patch-region",
        category: "content-model",
        conflictKey: conflictKeyOf(o),
        ...(creates ? { createsTarget: true } : {}),
      },
    ];
  },

  apply(ctx: OpContext, op: AssembleOp): OpResult {
    const o = narrow(op);
    const direction = o.direction ?? "insert";
    return direction === "remove" ? applyRemove(ctx, o) : applyInsert(ctx, o);
  },
};
