/**
 * planner × addFragment 整目录铺开（R4 / cfhiub）：计划期模拟态须看到铺出的每个文件，
 * 后续 deleteField / deleteFile 才能作用于它们；exclude / rename 在计划期同样生效。
 * 沙盒：fragment 源落 os.tmpdir()，afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Recipe } from "@/assemble/types";
import { plan } from "@/assemble/planner";
import { registerBuiltinOps, unregisterAll } from "@/assemble/registry";
import { addFragmentHandler } from "@/assemble/ops/add-fragment";

const recipe = (ops: Recipe["ops"]): Recipe => ({
  id: "r",
  base: { kind: "empty" },
  output: "out",
  ops,
});

const write = (root: string, rel: string, content: string): void => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

describe("planner × addFragment 目录铺开（R4）", () => {
  let root: string;
  beforeEach(() => {
    unregisterAll();
    registerBuiltinOps();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "spread-"));
    write(root, "tpl/package.json", '{"devDependencies":{"husky":"1"}}');
    write(root, "tpl/README.md", "# x");
    write(root, "tpl/src/a.json", "{}");
  });
  afterEach(() => {
    unregisterAll();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const spread = (over: Record<string, unknown> = {}) =>
    ({
      type: "addFragment",
      id: "spread",
      source: "tpl",
      target: ".",
      ...over,
    }) as never;

  it("铺开后 deleteField 作用于铺出的文件 → plan 通过", () => {
    const r = recipe([
      spread(),
      {
        type: "deleteField",
        id: "rm",
        target: "package.json",
        pointer: "/devDependencies/husky",
      } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: root })).not.toThrow();
  });

  it("嵌套目录 + 非根 target：deleteField 作用于 pkg/src/a.json → plan 通过", () => {
    const r = recipe([
      spread({ target: "pkg" }),
      {
        type: "deleteField",
        id: "rm",
        target: "pkg/src/a.json",
        pointer: "/x",
      } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: root })).not.toThrow();
  });

  it("exclude 掉的文件计划期不存在 → deleteField 仍 fail（C5）", () => {
    const r = recipe([
      spread({ exclude: ["package.json"] }),
      {
        type: "deleteField",
        id: "rm",
        target: "package.json",
        pointer: "/devDependencies/husky",
      } as never,
    ]);
    expect(() => plan(r, { fragmentRoot: root })).toThrow(/不存在于 VFS/);
  });

  it("rename 在计划期生效：新名可见、旧名不可见", () => {
    const ok = recipe([
      spread({ rename: { "README.md": "README.zh.md" } }),
      {
        type: "deleteFile",
        id: "d",
        target: "README.zh.md",
        allowDiscard: true,
      } as never,
    ]);
    expect(() => plan(ok, { fragmentRoot: root })).not.toThrow();
    const bad = recipe([
      spread({ rename: { "README.md": "README.zh.md" } }),
      { type: "deleteFile", id: "d", target: "README.md" } as never,
    ]);
    expect(() => plan(bad, { fragmentRoot: root })).toThrow(/不存在/);
  });

  it("deleteFile 删铺出的文件 = 写后删，默认 fail，allowDiscard 放行", () => {
    const del = (allowDiscard?: boolean) =>
      recipe([
        spread(),
        {
          type: "deleteFile",
          id: "d",
          target: "README.md",
          ...(allowDiscard ? { allowDiscard } : {}),
        } as never,
      ]);
    expect(() => plan(del(), { fragmentRoot: root })).toThrow(/先写后删/);
    expect(() => plan(del(true), { fragmentRoot: root })).not.toThrow();
  });

  it("effects：目录源按文件展开；无上下文 / 单文件源保持单条 op.target", () => {
    const ctx = {
      vfs: undefined as never,
      recipe: recipe([]),
      fragmentRoot: root,
    };
    const targets = addFragmentHandler
      .effects(spread({ target: "pkg" }), ctx)
      .map((e) => e.target)
      .sort();
    expect(targets).toEqual([
      "pkg/README.md",
      "pkg/package.json",
      "pkg/src/a.json",
    ]);
    expect(addFragmentHandler.effects(spread()).map((e) => e.target)).toEqual([
      ".",
    ]);
    const single = addFragmentHandler.effects(
      spread({ source: "tpl/README.md", target: "README.md" }),
      ctx,
    );
    expect(single.map((e) => e.target)).toEqual(["README.md"]);
  });
});
