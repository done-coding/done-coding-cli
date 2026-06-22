/**
 * [B3] deleteFile op 单测：当前态删除 + 删不存在 fail（D-H5/C5）。
 * 写后删 / 删后重建 的顺序语义在 planner 测（B4），此处仅测 op 当前态行为。
 */
import { describe, expect, it } from "vitest";
import type { AssembleOp, OpContext, Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import { deleteFileHandler } from "@/assemble/ops/delete-file";

const recipe: Recipe = {
  id: "r",
  base: { kind: "empty" },
  output: "o",
  ops: [],
};

const makeCtx = (initial: string[]): OpContext => {
  const vfs = createVfs();
  for (const p of initial) vfs.setFile(p, Buffer.from("x"), "seed");
  return {
    vfs,
    recipe,
    fragmentRoot: "/frag",
    render: (t) => t,
    readFragment: () => "",
  };
};

const op: AssembleOp = {
  type: "deleteFile",
  id: "rm",
  target: ".eslintrc.cjs",
} as AssembleOp;

describe("[B3] deleteFile", () => {
  it("存在则删", () => {
    const ctx = makeCtx([".eslintrc.cjs"]);
    deleteFileHandler.apply(ctx, op);
    expect(ctx.vfs.has(".eslintrc.cjs")).toBe(false);
  });

  it("不存在则 throw（C5）", () => {
    const ctx = makeCtx([]);
    expect(() => deleteFileHandler.apply(ctx, op)).toThrow(/不存在/);
  });

  it("effects 声明 delete-file", () => {
    expect(deleteFileHandler.effects(op)).toEqual([
      {
        target: ".eslintrc.cjs",
        kind: "delete-file",
        category: "delete",
        removesTarget: true,
      },
    ]);
  });
});
