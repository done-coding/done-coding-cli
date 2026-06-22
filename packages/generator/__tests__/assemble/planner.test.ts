/**
 * [B4] planner 单测：有序计划 / 混 kind fail / conflictKey 重复 fail /
 * deleteFile 顺序模拟（删不存在 fail / 写后删 fail / 删后重建 OK）/ preflight fail-loud（D-H3/D-H5）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import { plan } from "@/assemble/planner";
import { registerBuiltinOps, unregisterAll } from "@/assemble/registry";

const FRAG = "/frag";

const recipe = (ops: Recipe["ops"], base?: Recipe["base"]): Recipe => ({
  id: "r",
  base: base ?? { kind: "empty" },
  output: "out",
  ops,
});

describe("[B4] planner", () => {
  beforeEach(() => {
    unregisterAll();
    registerBuiltinOps();
  });
  afterEach(() => unregisterAll());

  it("有序计划：保 ops 声明顺序 + effects（纯 effect 类，不读 fs 源）", () => {
    const base = createVfs();
    base.setFile("f.txt", Buffer.from("x"), "__base__");
    const r = recipe([
      { type: "deleteFile", id: "b", target: "f.txt" } as never,
    ]);
    const p = plan(r, { fragmentRoot: FRAG, baseVfs: base });
    expect(p.recipeId).toBe("r");
    expect(p.items.map((i) => i.id)).toEqual(["b"]);
    expect(p.items[0].effects[0].kind).toBe("delete-file");
  });

  it("混内容模型 kind（patch-region + merge-structured）→ fail-fast（D-H3）", () => {
    const r = recipe([
      {
        type: "textPatch",
        id: "t",
        source: "n.md",
        target: "package.json",
        markerKey: "k",
        anchor: { pattern: "x", position: "after" },
      } as never,
      {
        type: "jsonMerge",
        id: "j",
        source: "p.json",
        target: "package.json",
      } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: FRAG })).toThrow(/混用|内容模型/);
  });

  it("同 target 同 conflictKey 重复 → fail（D-M4/D-H3）", () => {
    const r = recipe([
      {
        type: "textPatch",
        id: "t1",
        source: "n.md",
        target: "README.md",
        markerKey: "same",
        anchor: { pattern: "x", position: "after" },
      } as never,
      {
        type: "textPatch",
        id: "t2",
        source: "n.md",
        target: "README.md",
        markerKey: "same",
        anchor: { pattern: "y", position: "after" },
      } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: FRAG })).toThrow(/conflictKey/);
  });

  it("deleteFile 删不存在 → fail（D-H5）", () => {
    const r = recipe([
      { type: "deleteFile", id: "d", target: "ghost.txt" } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: FRAG })).toThrow(/不存在/);
  });

  it("deleteFile 删 base 存在文件 → OK", () => {
    const base = createVfs();
    base.setFile("a.txt", Buffer.from("A"), "__base__");
    const r = recipe([
      { type: "deleteFile", id: "d", target: "a.txt" } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: FRAG, baseVfs: base })).not.toThrow();
  });

  it("先写后删默认 fail（写后删，D-H5）", () => {
    // textPatch 写 new.txt 后 deleteFile 删之 = 吞前序贡献，默认 fail
    const r2 = recipe([
      {
        type: "textPatch",
        id: "w",
        source: "n.md",
        target: "new.txt",
        markerKey: "k",
        anchor: { pattern: "x", position: "after" },
      } as never,
      { type: "deleteFile", id: "d", target: "new.txt" } as never,
    ]);
    expect(() => plan(r2, { fragmentRoot: FRAG })).toThrow(
      /先写后删|allowDiscard/,
    );
  });

  it("写后删 + allowDiscard:true → OK 且 plan 标 discardsPrior", () => {
    const r = recipe([
      {
        type: "textPatch",
        id: "w",
        source: "n.md",
        target: "new.txt",
        markerKey: "k",
        anchor: { pattern: "x", position: "after" },
      } as never,
      {
        type: "deleteFile",
        id: "d",
        target: "new.txt",
        allowDiscard: true,
      } as never,
    ]);
    const p = plan(r, { fragmentRoot: FRAG });
    const delItem = p.items.find((i) => i.id === "d");
    expect(delItem?.discardsPrior).toBe(true);
  });

  it("删后重建 → OK（textPatch 写 → delete → 再 textPatch 写）", () => {
    const base = createVfs();
    base.setFile("f.txt", Buffer.from("orig"), "__base__");
    const r = recipe([
      { type: "deleteFile", id: "d", target: "f.txt" } as never,
      {
        type: "textPatch",
        id: "w",
        source: "n.md",
        target: "f.txt",
        markerKey: "k",
        anchor: { pattern: "x", position: "after" },
      } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: FRAG, baseVfs: base })).not.toThrow();
  });

  it("未知 op type → fail（C3）", () => {
    const r = recipe([{ type: "zzz", id: "x", target: "y" } as never]);
    expect(() => plan(r, { fragmentRoot: FRAG })).toThrow(/未知 op type/);
  });
});
