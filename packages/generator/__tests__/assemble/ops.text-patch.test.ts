/**
 * [B3] textPatch op 单测：正向插入（anchor + marker）/ 幂等重跑 / 反向移除 /
 * 锚点多命中默认 fail（D-M4）/ anchorMatch:"first" 降级 / direction remove。
 * 沙盒：fragment 源落 os.tmpdir()，afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AssembleOp, OpContext, Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import { readFragment } from "@/assemble/render";
import { textPatchHandler } from "@/assemble/ops/text-patch";

const recipe: Recipe = {
  id: "r",
  base: { kind: "empty" },
  output: "o",
  ops: [],
};

describe("[B3] textPatch", () => {
  let root: string;
  let ctx: OpContext;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "tp-"));
    ctx = {
      vfs: createVfs(),
      recipe,
      fragmentRoot: root,
      render: (t) => t,
      readFragment: (rel) => readFragment(root, rel),
    };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const op = (over: Partial<AssembleOp>): AssembleOp =>
    ({
      type: "textPatch",
      id: "patch",
      source: "note.md",
      target: "README.md",
      ...over,
    }) as AssembleOp;

  it("正向插入：anchor 后插入 marker 包裹块", () => {
    fs.writeFileSync(path.join(root, "note.md"), "INSERTED-LINE");
    ctx.vfs.setFile(
      "README.md",
      Buffer.from("# Title\n<!-- badges -->\nbody"),
      "seed",
    );
    textPatchHandler.apply(
      ctx,
      op({
        markerKey: "note",
        anchor: { pattern: "<!-- badges -->", position: "after" },
      }),
    );
    const out = ctx.vfs.get("README.md")!.content!.toString();
    expect(out).toContain("=== dc-gen:start:note ===");
    expect(out).toContain("INSERTED-LINE");
    expect(out).toContain("=== dc-gen:end:note ===");
  });

  it("幂等重跑：同 markerKey 原位替换不重复", () => {
    fs.writeFileSync(path.join(root, "note.md"), "V1");
    ctx.vfs.setFile("README.md", Buffer.from("<!-- badges -->\n"), "seed");
    textPatchHandler.apply(
      ctx,
      op({
        markerKey: "note",
        anchor: { pattern: "<!-- badges -->", position: "after" },
      }),
    );
    fs.writeFileSync(path.join(root, "note.md"), "V2");
    textPatchHandler.apply(
      ctx,
      op({
        markerKey: "note",
        anchor: { pattern: "<!-- badges -->", position: "after" },
      }),
    );
    const out = ctx.vfs.get("README.md")!.content!.toString();
    expect(out).toContain("V2");
    expect(out).not.toContain("V1");
    expect(out.match(/=== dc-gen:start:note ===/g)?.length).toBe(1);
  });

  it("锚点多命中默认 fail（D-M4）", () => {
    fs.writeFileSync(path.join(root, "note.md"), "X");
    ctx.vfs.setFile("README.md", Buffer.from("anchor\nfoo\nanchor\n"), "seed");
    expect(() =>
      textPatchHandler.apply(
        ctx,
        op({
          markerKey: "note",
          anchor: { pattern: "anchor", position: "after" },
        }),
      ),
    ).toThrow(/多命中/);
  });

  it("anchorMatch:'first' 降级取首个", () => {
    fs.writeFileSync(path.join(root, "note.md"), "X");
    ctx.vfs.setFile("README.md", Buffer.from("anchor\nfoo\nanchor\n"), "seed");
    expect(() =>
      textPatchHandler.apply(
        ctx,
        op({
          markerKey: "note",
          anchorMatch: "first",
          anchor: { pattern: "anchor", position: "after" },
        }),
      ),
    ).not.toThrow();
  });

  it("direction remove：按 markerKey 反向移除块", () => {
    fs.writeFileSync(path.join(root, "note.md"), "BODY");
    ctx.vfs.setFile("README.md", Buffer.from("<!-- badges -->\n"), "seed");
    textPatchHandler.apply(
      ctx,
      op({
        markerKey: "note",
        anchor: { pattern: "<!-- badges -->", position: "after" },
      }),
    );
    expect(ctx.vfs.get("README.md")!.content!.toString()).toContain("BODY");
    textPatchHandler.apply(ctx, op({ markerKey: "note", direction: "remove" }));
    expect(ctx.vfs.get("README.md")!.content!.toString()).not.toContain("BODY");
  });

  it("effects 声明 patch-region + conflictKey=markerKey（缺省 op.id）", () => {
    expect(textPatchHandler.effects(op({}))).toEqual([
      {
        target: "README.md",
        kind: "patch-region",
        category: "content-model",
        conflictKey: "patch",
        createsTarget: true,
      },
    ]);
    expect(
      textPatchHandler.effects(op({ markerKey: "k" }))[0].conflictKey,
    ).toBe("k");
  });
});
