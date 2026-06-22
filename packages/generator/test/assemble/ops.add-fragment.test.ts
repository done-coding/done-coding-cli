/**
 * [B3] addFragment op 单测：单文件 / 目录递归 / include·exclude / rename / mode /
 * symlinkPolicy / emptyDirPolicy / ifExists（D-H7/D-M5）+ render。
 * 沙盒：fragment 源落 os.tmpdir()，afterEach 清理。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AssembleOp, OpContext, Recipe } from "@/assemble/types";
import { createVfs } from "@/assemble/vfs";
import {
  createRender,
  readFragment,
  readFragmentBuffer,
} from "@/assemble/render";
import { addFragmentHandler } from "@/assemble/ops/add-fragment";

const recipe: Recipe = {
  id: "r",
  base: { kind: "empty" },
  output: "o",
  ops: [],
};

describe("[B3] addFragment", () => {
  let root: string;
  let ctx: OpContext;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "af-"));
    ctx = {
      vfs: createVfs(),
      recipe,
      fragmentRoot: root,
      render: createRender({ name: "Foo" }),
      readFragment: (rel) => readFragment(root, rel),
      readFragmentBuffer: (rel) => readFragmentBuffer(root, rel),
    };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const op = (over: Partial<AssembleOp>): AssembleOp =>
    ({
      type: "addFragment",
      id: "add",
      source: "",
      target: "",
      ...over,
    }) as AssembleOp;

  it("单文件 + render 变量", () => {
    fs.writeFileSync(path.join(root, "a.txt"), "hi <%= name %>");
    addFragmentHandler.apply(ctx, op({ source: "a.txt", target: "out.txt" }));
    expect(ctx.vfs.get("out.txt")?.content?.toString()).toBe("hi Foo");
  });

  it("目录递归 + include/exclude glob", () => {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src", "a.ts"), "a");
    fs.writeFileSync(path.join(root, "src", "b.js"), "b");
    fs.writeFileSync(path.join(root, "src", "skip.log"), "x");
    addFragmentHandler.apply(
      ctx,
      op({
        source: "src",
        target: "dst",
        include: ["*.ts", "*.js"],
        exclude: ["*.log"],
      }),
    );
    expect(ctx.vfs.has("dst/a.ts")).toBe(true);
    expect(ctx.vfs.has("dst/b.js")).toBe(true);
    expect(ctx.vfs.has("dst/skip.log")).toBe(false);
  });

  it("rename 映射 + mode preserve", () => {
    fs.writeFileSync(path.join(root, "run.sh"), "#!/bin/sh", { mode: 0o755 });
    fs.chmodSync(path.join(root, "run.sh"), 0o755);
    addFragmentHandler.apply(
      ctx,
      op({ source: "run.sh", target: "bin/run.sh", mode: "preserve" }),
    );
    expect(ctx.vfs.get("bin/run.sh")?.mode).toBe(0o755);
  });

  it("emptyDirPolicy keep 保留空目录", () => {
    fs.mkdirSync(path.join(root, "pkg"));
    fs.mkdirSync(path.join(root, "pkg", "empty"));
    fs.writeFileSync(path.join(root, "pkg", "a.txt"), "a");
    addFragmentHandler.apply(
      ctx,
      op({ source: "pkg", target: "dst", emptyDirPolicy: "keep" }),
    );
    expect(ctx.vfs.get("dst/empty")?.kind).toBe("dir");
  });

  it("symlinkPolicy preserve 写软链节点", () => {
    fs.mkdirSync(path.join(root, "d"));
    fs.writeFileSync(path.join(root, "d", "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "d", "link.txt"));
    addFragmentHandler.apply(
      ctx,
      op({ source: "d", target: "dst", symlinkPolicy: "preserve" }),
    );
    expect(ctx.vfs.get("dst/link.txt")?.kind).toBe("symlink");
    expect(ctx.vfs.get("dst/link.txt")?.linkTarget).toBe("real.txt");
  });

  it("symlinkPolicy deref（目录内）→ 软链解引用为真实文件内容", () => {
    fs.mkdirSync(path.join(root, "d"));
    fs.writeFileSync(path.join(root, "d", "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "d", "link.txt"));
    addFragmentHandler.apply(
      ctx,
      op({ source: "d", target: "dst", symlinkPolicy: "deref" }),
    );
    expect(ctx.vfs.get("dst/link.txt")?.kind).toBe("file");
    expect(ctx.vfs.get("dst/link.txt")?.content?.toString()).toBe("R");
  });

  it("symlinkPolicy skip（目录内）→ 软链被跳过", () => {
    fs.mkdirSync(path.join(root, "d"));
    fs.writeFileSync(path.join(root, "d", "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "d", "link.txt"));
    addFragmentHandler.apply(
      ctx,
      op({ source: "d", target: "dst", symlinkPolicy: "skip" }),
    );
    expect(ctx.vfs.has("dst/real.txt")).toBe(true);
    expect(ctx.vfs.has("dst/link.txt")).toBe(false);
  });

  it("单 symlink 源 preserve → 写软链节点到 target", () => {
    fs.writeFileSync(path.join(root, "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "link.txt"));
    addFragmentHandler.apply(
      ctx,
      op({ source: "link.txt", target: "out.link", symlinkPolicy: "preserve" }),
    );
    expect(ctx.vfs.get("out.link")?.kind).toBe("symlink");
    expect(ctx.vfs.get("out.link")?.linkTarget).toBe("real.txt");
  });

  it("单 symlink 源 deref → 解引用为真实文件内容", () => {
    fs.writeFileSync(path.join(root, "real.txt"), "DEREF");
    fs.symlinkSync("real.txt", path.join(root, "link.txt"));
    addFragmentHandler.apply(
      ctx,
      op({ source: "link.txt", target: "out.txt", symlinkPolicy: "deref" }),
    );
    expect(ctx.vfs.get("out.txt")?.kind).toBe("file");
    expect(ctx.vfs.get("out.txt")?.content?.toString()).toBe("DEREF");
  });

  it("单 symlink 源 skip → 不产出节点", () => {
    fs.writeFileSync(path.join(root, "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "link.txt"));
    const res = addFragmentHandler.apply(
      ctx,
      op({ source: "link.txt", target: "out.skip", symlinkPolicy: "skip" }),
    );
    expect(res.changed).toBe(false);
    expect(ctx.vfs.has("out.skip")).toBe(false);
  });

  it("ifExists 默认 error（目标已存在 → throw）", () => {
    fs.writeFileSync(path.join(root, "a.txt"), "a");
    ctx.vfs.setFile("out.txt", Buffer.from("existing"), "prev");
    expect(() =>
      addFragmentHandler.apply(ctx, op({ source: "a.txt", target: "out.txt" })),
    ).toThrow(/已存在/);
  });

  it("ifExists keep 保留既有", () => {
    fs.writeFileSync(path.join(root, "a.txt"), "new");
    ctx.vfs.setFile("out.txt", Buffer.from("existing"), "prev");
    addFragmentHandler.apply(
      ctx,
      op({ source: "a.txt", target: "out.txt", ifExists: "keep" }),
    );
    expect(ctx.vfs.get("out.txt")?.content?.toString()).toBe("existing");
  });

  it("H3 已存在 symlink 再写 → 默认 error（不静默覆盖）", () => {
    fs.mkdirSync(path.join(root, "d"));
    fs.writeFileSync(path.join(root, "d", "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "d", "link.txt"));
    // 预置目标 dst/link.txt 已存在
    ctx.vfs.setNode("dst/link.txt", {
      kind: "symlink",
      linkTarget: "old",
      provenance: { lastOpId: "prev", contributingOpIds: ["prev"] },
    });
    expect(() =>
      addFragmentHandler.apply(
        ctx,
        op({ source: "d", target: "dst", symlinkPolicy: "preserve" }),
      ),
    ).toThrow(/已存在/);
  });

  it("H3 已存在 dir 再写空目录 → 默认 error（不静默覆盖）", () => {
    fs.mkdirSync(path.join(root, "pkg"));
    fs.mkdirSync(path.join(root, "pkg", "empty"));
    ctx.vfs.setNode("dst/empty", {
      kind: "dir",
      provenance: { lastOpId: "prev", contributingOpIds: ["prev"] },
    });
    expect(() =>
      addFragmentHandler.apply(
        ctx,
        op({ source: "pkg", target: "dst", emptyDirPolicy: "keep" }),
      ),
    ).toThrow(/已存在/);
  });

  it("M1 二进制碎片逐字节保留（不 utf-8 化 / 不规范化 EOL）", () => {
    // 含 NUL + CRLF 的二进制（NUL 触发二进制判定，CRLF 须原样保留）
    const bin = Buffer.from([0x00, 0x0d, 0x0a, 0xff, 0xfe, 0x41]);
    fs.writeFileSync(path.join(root, "img.bin"), bin);
    addFragmentHandler.apply(ctx, op({ source: "img.bin", target: "o.bin" }));
    const out = ctx.vfs.get("o.bin")?.content;
    expect(out?.equals(bin)).toBe(true);
  });

  it("M4 CRLF 文本碎片 → 产物 LF", () => {
    fs.writeFileSync(path.join(root, "t.txt"), "a\r\nb\r\n");
    addFragmentHandler.apply(ctx, op({ source: "t.txt", target: "o.txt" }));
    expect(ctx.vfs.get("o.txt")?.content?.toString("utf-8")).toBe("a\nb\n");
  });

  it("preflight 源不存在 → throw", () => {
    expect(() =>
      addFragmentHandler.preflight!(ctx, op({ source: "nope", target: "x" })),
    ).toThrow();
  });

  it("preflight 源越界 fragmentRoot → throw（C2）", () => {
    expect(() =>
      addFragmentHandler.preflight!(
        ctx,
        op({ source: "../escape", target: "x" }),
      ),
    ).toThrow(/越界/);
  });
});
