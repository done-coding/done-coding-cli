/**
 * [T1] writeFile op 单测：content 精确 / target 路径 / preflight 词法守卫 / ifExists（D-M5）/
 * 不渲染不改 EOL / registry 注册后 resolveOp 可用（A-NFR-4）。
 * 沙盒：recipe.output 相对路径即产物根，目标键只在 VFS 内，不写盘，无污染。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AssembleOp, OpContext, Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import { createRender } from "@/assemble/render";
import { writeFileHandler } from "@/assemble/ops/write-file";
import {
  registerBuiltinOps,
  resolveOp,
  unregisterAll,
} from "@/assemble/registry";

const recipe: Recipe = {
  id: "r",
  base: { kind: "empty" },
  output: "o",
  ops: [],
};

describe("[T1] writeFile", () => {
  let root: string;
  let ctx: OpContext;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "wf-"));
    ctx = {
      vfs: createVfs(),
      recipe,
      fragmentRoot: root,
      render: createRender({ name: "Foo" }),
      readFragment: () => "",
      readFragmentBuffer: () => Buffer.alloc(0),
    };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const op = (over: Partial<AssembleOp>): AssembleOp =>
    ({
      type: "writeFile",
      id: "wf",
      target: "",
      content: "",
      ...over,
    }) as AssembleOp;

  it("content 精确落盘（含模板语法原样，零转义）", () => {
    const src = "org=${organization}\n<%- title %>\n  tail";
    writeFileHandler.apply(ctx, op({ target: "o.txt", content: src }));
    expect(ctx.vfs.get("o.txt")?.content?.toString("utf-8")).toBe(src);
  });

  it("嵌套 target 路径写入", () => {
    writeFileHandler.apply(
      ctx,
      op({ target: "src/deep/file.ts", content: "export const a = 1;\n" }),
    );
    expect(ctx.vfs.get("src/deep/file.ts")?.content?.toString()).toBe(
      "export const a = 1;\n",
    );
    expect(ctx.vfs.has("src/deep/file.ts")).toBe(true);
  });

  it("provenance：lastOpId/contributingOpIds = op.id", () => {
    writeFileHandler.apply(ctx, op({ target: "a.txt", content: "x" }));
    expect(ctx.vfs.get("a.txt")?.provenance).toEqual({
      lastOpId: "wf",
      contributingOpIds: ["wf"],
    });
  });

  it("result.changed=true（新写入）", () => {
    const res = writeFileHandler.apply(
      ctx,
      op({ target: "a.txt", content: "x" }),
    );
    expect(res.changed).toBe(true);
  });

  it("preflight 正常 target 通过", () => {
    expect(() =>
      writeFileHandler.preflight!(
        ctx,
        op({ target: "src/a.ts", content: "x" }),
      ),
    ).not.toThrow();
  });

  it("preflight 词法守卫：target 首段 `..` 逃逸 → throw", () => {
    expect(() =>
      writeFileHandler.preflight!(
        ctx,
        op({ target: "../escape", content: "x" }),
      ),
    ).toThrow(/越界/);
  });

  it("preflight 词法守卫：target 中段 `..` 逃逸 → throw", () => {
    expect(() =>
      writeFileHandler.preflight!(
        ctx,
        op({ target: "src/../escape", content: "x" }),
      ),
    ).toThrow(/越界/);
  });

  it("preflight 词法守卫：target 绝对路径 → throw", () => {
    expect(() =>
      writeFileHandler.preflight!(
        ctx,
        op({ target: "/etc/passwd", content: "x" }),
      ),
    ).toThrow(/越界/);
  });

  it("ifExists 默认 error（目标已存在 → throw）", () => {
    ctx.vfs.setFile("out.txt", Buffer.from("existing"), "prev");
    expect(() =>
      writeFileHandler.apply(ctx, op({ target: "out.txt", content: "new" })),
    ).toThrow(/已存在/);
  });

  it("ifExists keep 保留既有", () => {
    ctx.vfs.setFile("out.txt", Buffer.from("existing"), "prev");
    const res = writeFileHandler.apply(
      ctx,
      op({ target: "out.txt", content: "new", ifExists: "keep" }),
    );
    expect(res.changed).toBe(false);
    expect(ctx.vfs.get("out.txt")?.content?.toString()).toBe("existing");
  });

  it("content 含 CRLF 不改 EOL（不 normalize）", () => {
    const src = "a\r\nb\r\n";
    writeFileHandler.apply(ctx, op({ target: "o.txt", content: src }));
    expect(ctx.vfs.get("o.txt")?.content?.toString("utf-8")).toBe(src);
  });

  it("recipe.render=true 也不渲染（字面即终值）", () => {
    const renderCtx: OpContext = {
      ...ctx,
      recipe: { ...recipe, render: true },
    };
    const src = "hi <%= name %>";
    writeFileHandler.apply(renderCtx, op({ target: "o.txt", content: src }));
    expect(ctx.vfs.get("o.txt")?.content?.toString("utf-8")).toBe(src);
  });

  it("registry 注册后 resolveOp 可用（A-NFR-4，planner/engine 零改）", () => {
    unregisterAll();
    registerBuiltinOps();
    const handler = resolveOp("writeFile");
    expect(handler).toBe(writeFileHandler);
    handler.apply(ctx, op({ target: "r.txt", content: "from registry" }));
    expect(ctx.vfs.get("r.txt")?.content?.toString()).toBe("from registry");
  });
});
