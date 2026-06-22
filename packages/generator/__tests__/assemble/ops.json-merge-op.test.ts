/**
 * [B3] jsonMerge op 单测：合并写回 + 冲突 fail-loud 带 provenance + .json only（D-H8/D-L1/D-L4）。
 * 沙盒：source 碎片落 os.tmpdir()，afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AssembleOp, OpContext, Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import { readFragment } from "@/assemble/render";
import { jsonMergeHandler } from "@/assemble/ops/json-merge-op";

const recipe: Recipe = {
  id: "r",
  base: { kind: "empty" },
  output: "o",
  ops: [],
};

describe("[B3] jsonMerge op", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "jm-op-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const makeCtx = (base: string): OpContext => {
    const vfs = createVfs();
    vfs.setFile("package.json", Buffer.from(base), "seed");
    return {
      vfs,
      recipe,
      fragmentRoot: root,
      render: (t) => t,
      readFragment: (rel) => readFragment(root, rel),
    };
  };

  const op = (over?: Partial<AssembleOp>): AssembleOp =>
    ({
      type: "jsonMerge",
      id: "merge",
      source: "patch.json",
      target: "package.json",
      ...over,
    }) as AssembleOp;

  it("深合并写回（deps 新增 + scripts 合并）", () => {
    fs.writeFileSync(
      path.join(root, "patch.json"),
      JSON.stringify({
        dependencies: { lodash: "^4" },
        scripts: { build: "b" },
      }),
    );
    const ctx = makeCtx(
      '{\n  "dependencies": {\n    "vue": "^3"\n  },\n  "scripts": {\n    "dev": "d"\n  }\n}\n',
    );
    jsonMergeHandler.apply(ctx, op());
    const out = JSON.parse(ctx.vfs.get("package.json")!.content!.toString());
    expect(out.dependencies).toEqual({ vue: "^3", lodash: "^4" });
    expect(out.scripts).toEqual({ dev: "d", build: "b" });
  });

  it("同包异版本冲突 → throw 带 file/op/source（D-L4）", () => {
    fs.writeFileSync(
      path.join(root, "patch.json"),
      JSON.stringify({ dependencies: { vue: "^2" } }),
    );
    const ctx = makeCtx('{ "dependencies": { "vue": "^3" } }');
    expect(() => jsonMergeHandler.apply(ctx, op())).toThrow(/冲突/);
    try {
      jsonMergeHandler.apply(ctx, op());
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("package.json");
      expect(msg).toContain("merge");
      expect(msg).toContain("patch.json");
    }
  });

  it("M2 冲突报错含两侧不同来源（base 侧=前序贡献者 / patch 侧=当前 op）", () => {
    fs.writeFileSync(
      path.join(root, "patch.json"),
      JSON.stringify({ dependencies: { vue: "^2" } }),
    );
    const ctx = makeCtx('{ "dependencies": { "vue": "^3" } }'); // base 节点 opId="seed"
    try {
      jsonMergeHandler.apply(ctx, op());
      throw new Error("应当抛冲突");
    } catch (e) {
      const msg = (e as Error).message;
      // base 侧来源 = 既有节点 provenance.lastOpId（"seed"），patch 侧 = 当前 op（"merge"）
      expect(msg).toContain("seed");
      expect(msg).toContain("merge");
      // 两侧不同（非都写当前 op）
      expect(msg.indexOf("seed")).not.toBe(msg.indexOf("merge"));
    }
  });

  it("非 .json source → fail（D-L1）", () => {
    const ctx = makeCtx("{}");
    expect(() =>
      jsonMergeHandler.apply(ctx, op({ source: "patch.yaml" })),
    ).toThrow(/\.json/);
  });

  it("effects 声明 merge-structured", () => {
    expect(jsonMergeHandler.effects(op())).toEqual([
      {
        target: "package.json",
        kind: "merge-structured",
        category: "content-model",
        createsTarget: true,
      },
    ]);
  });
});
