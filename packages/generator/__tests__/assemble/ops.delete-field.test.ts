/**
 * [B3] deleteField op 单测：正向删字段 + 删不存在 fail + 非 .json fail（D-H5/C5/D-L1）。
 */
import { describe, expect, it } from "vitest";
import type { AssembleOp, OpContext, Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import { deleteFieldHandler } from "@/assemble/ops/delete-field";

const recipe: Recipe = {
  id: "r",
  base: { kind: "empty" },
  output: "o",
  ops: [],
};

const makeCtx = (initial: Record<string, string>): OpContext => {
  const vfs = createVfs();
  for (const [p, c] of Object.entries(initial))
    vfs.setFile(p, Buffer.from(c), "seed");
  return {
    vfs,
    recipe,
    fragmentRoot: "/frag",
    render: (t) => t,
    readFragment: () => "",
  };
};

const op = (over: Partial<AssembleOp>): AssembleOp =>
  ({
    type: "deleteField",
    id: "rm",
    target: "package.json",
    pointer: "/scripts/push",
    ...over,
  }) as AssembleOp;

describe("[B3] deleteField", () => {
  it("删除存在字段并保留 base 风格", () => {
    const ctx = makeCtx({
      "package.json":
        '{\n  "scripts": {\n    "push": "x",\n    "test": "y"\n  }\n}\n',
    });
    deleteFieldHandler.apply(ctx, op({}));
    const out = JSON.parse(ctx.vfs.get("package.json")!.content!.toString());
    expect(out.scripts.push).toBeUndefined();
    expect(out.scripts.test).toBe("y");
  });

  it("删不存在 pointer → throw（C5）", () => {
    const ctx = makeCtx({ "package.json": '{\n  "scripts": {}\n}\n' });
    expect(() => deleteFieldHandler.apply(ctx, op({}))).toThrow();
  });

  it("非 .json target → fail（D-L1）", () => {
    const ctx = makeCtx({ "README.md": "x" });
    expect(() =>
      deleteFieldHandler.apply(ctx, op({ target: "README.md" })),
    ).toThrow(/\.json/);
  });

  it("effects 声明 delete-field + conflictKey=pointer", () => {
    expect(deleteFieldHandler.effects(op({}))).toEqual([
      {
        target: "package.json",
        kind: "delete-field",
        category: "metadata",
        conflictKey: "/scripts/push",
      },
    ]);
  });

  it("apply：target 不存在于 VFS → throw（C5，readJsonNode 守卫）", () => {
    const ctx = makeCtx({}); // 空 VFS，无 package.json
    expect(() => deleteFieldHandler.apply(ctx, op({}))).toThrow(/不存在于 VFS/);
  });

  it("preflight 非 .json target → fail（D-L1，requireJsonTarget）", () => {
    const ctx = makeCtx({ "README.md": "x" });
    expect(() =>
      deleteFieldHandler.preflight!(ctx, op({ target: "README.md" })),
    ).toThrow(/\.json/);
  });

  it("preflight target 不在 VFS → throw（C5）", () => {
    const ctx = makeCtx({});
    expect(() => deleteFieldHandler.preflight!(ctx, op({}))).toThrow(
      /不存在于 VFS/,
    );
  });

  it("preflight 模拟态内容可解析且 pointer 存在 → 通过（dry 丢弃）", () => {
    const ctx = makeCtx({
      "package.json": '{\n  "scripts": {\n    "push": "x"\n  }\n}\n',
    });
    expect(() => deleteFieldHandler.preflight!(ctx, op({}))).not.toThrow();
  });

  it("preflight 模拟态内容可解析但 pointer 不存在 → 提前 fail（tryParseJson 成功路径）", () => {
    const ctx = makeCtx({ "package.json": '{\n  "scripts": {}\n}\n' });
    expect(() => deleteFieldHandler.preflight!(ctx, op({}))).toThrow();
  });

  it("preflight 模拟态内容非合法 JSON（前序 op 产出占位）→ 推迟到 apply（tryParseJson 返回 undefined）", () => {
    // 内容不可解析 → preflight best-effort 放行，不在计划期 fail。
    const ctx = makeCtx({ "package.json": "<<placeholder>>" });
    expect(() => deleteFieldHandler.preflight!(ctx, op({}))).not.toThrow();
  });

  it("preflight 模拟态节点存在但 content 缺失（空占位）→ tryParseJson('') 推迟到 apply", () => {
    const vfs = createVfs();
    vfs.setFile("package.json", Buffer.alloc(0), "seed");
    const ctx: OpContext = {
      vfs,
      recipe,
      fragmentRoot: "/frag",
      render: (t) => t,
      readFragment: () => "",
    };
    expect(() => deleteFieldHandler.preflight!(ctx, op({}))).not.toThrow();
  });
});
