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

  it("单文件 + render:true 显式渲染变量", () => {
    fs.writeFileSync(path.join(root, "a.txt"), "hi <%= name %>");
    addFragmentHandler.apply(
      ctx,
      op({ source: "a.txt", target: "out.txt", render: true }),
    );
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

  it("M4 render:true CRLF 文本碎片 → 产物 LF", () => {
    fs.writeFileSync(path.join(root, "t.txt"), "a\r\nb\r\n");
    addFragmentHandler.apply(
      ctx,
      op({ source: "t.txt", target: "o.txt", render: true }),
    );
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

  // ───────────────── R1：raw 默认 + render 链（op > recipe > false） ─────────────────

  it("R1①默认 raw：含 ${}/<% 文本碎片原样字节（零转义）", () => {
    const src = "org=${organization}\n<%- title %>\n";
    fs.writeFileSync(path.join(root, "raw.txt"), src);
    addFragmentHandler.apply(ctx, op({ source: "raw.txt", target: "o.txt" }));
    expect(ctx.vfs.get("o.txt")?.content?.toString("utf-8")).toBe(src);
  });

  it("R1①默认 raw：CRLF 文本碎片保留 CRLF（不 normalize）", () => {
    fs.writeFileSync(path.join(root, "crlf.txt"), "a\r\nb\r\n");
    addFragmentHandler.apply(ctx, op({ source: "crlf.txt", target: "o.txt" }));
    expect(ctx.vfs.get("o.txt")?.content?.toString("utf-8")).toBe("a\r\nb\r\n");
  });

  it("R1②recipe.render=true + op 未设 → 渲染", () => {
    const renderCtx: OpContext = {
      ...ctx,
      recipe: { ...recipe, render: true },
    };
    fs.writeFileSync(path.join(root, "a.txt"), "hi <%= name %>");
    addFragmentHandler.apply(
      renderCtx,
      op({ source: "a.txt", target: "o.txt" }),
    );
    expect(ctx.vfs.get("o.txt")?.content?.toString()).toBe("hi Foo");
  });

  it("R1②recipe.render=true + op.render=false → op 覆盖为 raw", () => {
    const renderCtx: OpContext = {
      ...ctx,
      recipe: { ...recipe, render: true },
    };
    fs.writeFileSync(path.join(root, "a.txt"), "hi <%= name %>");
    addFragmentHandler.apply(
      renderCtx,
      op({ source: "a.txt", target: "o.txt", render: false }),
    );
    expect(ctx.vfs.get("o.txt")?.content?.toString()).toBe("hi <%= name %>");
  });

  // ───────────────── R2：resolveMode 默认保源 mode ─────────────────

  it("R2 spread 默认保留源 mode：0755 → 0755", () => {
    fs.mkdirSync(path.join(root, "bin"));
    fs.writeFileSync(path.join(root, "bin", "run.sh"), "#!/bin/sh\n");
    fs.chmodSync(path.join(root, "bin", "run.sh"), 0o755);
    addFragmentHandler.apply(ctx, op({ source: "bin", target: "dst" }));
    expect(ctx.vfs.get("dst/run.sh")?.mode).toBe(0o755);
  });

  it("R2 spread 默认保留源 mode：0644 → 0644", () => {
    fs.mkdirSync(path.join(root, "d"));
    fs.writeFileSync(path.join(root, "d", "a.txt"), "a");
    fs.chmodSync(path.join(root, "d", "a.txt"), 0o644);
    addFragmentHandler.apply(ctx, op({ source: "d", target: "dst" }));
    expect(ctx.vfs.get("dst/a.txt")?.mode).toBe(0o644);
  });

  it("R2 op.mode 显式 number 仍优先于源 mode", () => {
    fs.writeFileSync(path.join(root, "run.sh"), "#!/bin/sh\n");
    fs.chmodSync(path.join(root, "run.sh"), 0o755);
    addFragmentHandler.apply(
      ctx,
      op({ source: "run.sh", target: "o.sh", mode: 0o600 }),
    );
    expect(ctx.vfs.get("o.sh")?.mode).toBe(0o600);
  });

  it("R2 render:true 文本也保源 mode（0755）", () => {
    const renderCtx: OpContext = {
      ...ctx,
      recipe: { ...recipe, render: true },
    };
    fs.writeFileSync(path.join(root, "run.sh"), "#!/bin/sh <%= name %>\n");
    fs.chmodSync(path.join(root, "run.sh"), 0o755);
    addFragmentHandler.apply(
      renderCtx,
      op({ source: "run.sh", target: "o.sh", render: true }),
    );
    expect(ctx.vfs.get("o.sh")?.mode).toBe(0o755);
    expect(ctx.vfs.get("o.sh")?.content?.toString()).toBe("#!/bin/sh Foo\n");
  });

  // ───────────────── R3：exclude 滤空不残壳 / 源本空保真 ─────────────────

  it("R3①exclude 滤空 → 不产空壳（a/ 仅含被 exclude 文件）", () => {
    fs.mkdirSync(path.join(root, "a"));
    fs.writeFileSync(path.join(root, "a", "x.log"), "x");
    addFragmentHandler.apply(
      ctx,
      op({ source: ".", target: "dst", exclude: ["**/*.log"] }),
    );
    expect(ctx.vfs.has("dst/a")).toBe(false);
  });

  it("R3②源本空目录 → 保留（emptyDirPolicy 默认 keep）", () => {
    fs.mkdirSync(path.join(root, "b"));
    addFragmentHandler.apply(ctx, op({ source: ".", target: "dst" }));
    expect(ctx.vfs.get("dst/b")?.kind).toBe("dir");
  });

  it("R3④顶层 source 自身为空目录 → 产出 target dir（默认 keep，target=destRoot 不畸形）", () => {
    const emptyRoot = path.join(root, "solo-empty");
    fs.mkdirSync(emptyRoot);
    addFragmentHandler.apply(ctx, op({ source: "solo-empty", target: "dst" }));
    expect(ctx.vfs.get("dst")?.kind).toBe("dir");
    // 字面 key 为 "dst"（非畸形 "dst/"）；VFS 写入即归一，这里确认产物 key 集合干净。
    expect(ctx.vfs.paths()).toContain("dst");
  });

  it("R3④反向：顶层空 source + emptyDirPolicy skip → 不产出", () => {
    fs.mkdirSync(path.join(root, "solo-empty2"));
    addFragmentHandler.apply(
      ctx,
      op({ source: "solo-empty2", target: "dst", emptyDirPolicy: "skip" }),
    );
    expect(ctx.vfs.has("dst")).toBe(false);
  });

  it("R3③嵌套：c/x.log(excluded) + c/empty/(源本空) → 产 c/empty（c 经其保留）", () => {
    fs.mkdirSync(path.join(root, "c"));
    fs.writeFileSync(path.join(root, "c", "x.log"), "x");
    fs.mkdirSync(path.join(root, "c", "empty"));
    addFragmentHandler.apply(
      ctx,
      op({ source: ".", target: "dst", exclude: ["**/*.log"] }),
    );
    // c/empty（源本空）产 dir 节点 → c 作为其前缀在产物保留（flush 期递归 mkdir）。
    // 对比：仅含被 exclude 文件的子树（无源本空后代）则不产任何节点。
    expect(ctx.vfs.get("dst/c/empty")?.kind).toBe("dir");
  });
});
