/**
 * [B1] vfs 单测：内存树 / provenance 累积 / loadBaseDir 元数据 / flush 原子 swap /
 * manifest 孤儿删除 + untracked 保护（D-H1/D-H2/D-H7/D-M3/D-L2/D-L4）。
 * 沙盒：fixtures 落 os.tmpdir()，afterEach 清理（项目 CLAUDE.md 铁律）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertNoCaseCollision,
  createVfs,
  flush,
  loadBaseDir,
  readManifest,
  writeManifest,
} from "@/assemble/vfs";

describe("[B1] createVfs 基础读写 + provenance", () => {
  it("setFile/get/has/delete/paths（字典序）", () => {
    const vfs = createVfs();
    vfs.setFile("b.txt", Buffer.from("B"), "op1");
    vfs.setFile("a.txt", Buffer.from("A"), "op2");
    expect(vfs.has("a.txt")).toBe(true);
    expect(vfs.get("a.txt")?.content?.toString()).toBe("A");
    expect(vfs.paths()).toEqual(["a.txt", "b.txt"]);
    expect(vfs.delete("a.txt")).toBe(true);
    expect(vfs.delete("a.txt")).toBe(false);
  });

  it('键归一：setFile("./x") 与 get("x") 同键（防 target:"." 双键静默覆盖）', () => {
    const vfs = createVfs();
    vfs.setFile("./pkg/package.json", Buffer.from("A"), "op1");
    expect(vfs.has("pkg/package.json")).toBe(true);
    expect(vfs.get("pkg/package.json")?.content?.toString()).toBe("A");
    // 写裸键覆盖同一归一键（非新增第二键）
    vfs.setFile("pkg/package.json", Buffer.from("B"), "op2");
    expect(vfs.paths()).toEqual(["pkg/package.json"]);
    expect(vfs.get("./pkg/package.json")?.content?.toString()).toBe("B");
    expect(vfs.delete("./pkg/package.json")).toBe(true);
  });

  it("provenance 累积 contributingOpIds（D-L4）", () => {
    const vfs = createVfs();
    vfs.setFile("x", Buffer.from("1"), "op1");
    vfs.setFile("x", Buffer.from("2"), "op2");
    const node = vfs.get("x");
    expect(node?.provenance.lastOpId).toBe("op2");
    expect(node?.provenance.contributingOpIds).toEqual(["op1", "op2"]);
  });

  it("mode 选项保留", () => {
    const vfs = createVfs();
    vfs.setFile("s.sh", Buffer.from("#!/bin/sh"), "op1", { mode: 0o755 });
    expect(vfs.get("s.sh")?.mode).toBe(0o755);
  });
});

describe("[实2] assertNoCaseCollision case-fold 塌路径守卫（修订-2）", () => {
  const dir = (vfs: ReturnType<typeof createVfs>, p: string): void =>
    vfs.setNode(p, {
      kind: "dir",
      provenance: { lastOpId: "t", contributingOpIds: ["t"] },
    });

  it("同级 Foo.json + foo.json → throw（大小写塌陷）", () => {
    const vfs = createVfs();
    vfs.setFile("Foo.json", Buffer.from("A"), "op1");
    vfs.setFile("foo.json", Buffer.from("B"), "op2");
    expect(() => assertNoCaseCollision(vfs)).toThrow(/大小写塌陷/);
  });

  it("父目录塌陷 A/x + a/y → throw（大小写塌陷）", () => {
    const vfs = createVfs();
    vfs.setFile("A/x", Buffer.from("A"), "op1");
    vfs.setFile("a/y", Buffer.from("B"), "op2");
    expect(() => assertNoCaseCollision(vfs)).toThrow(/大小写塌陷/);
  });

  it("file-vs-dir 折叠：Foo 文件 + foo/bar → throw（类型塌陷）", () => {
    const vfs = createVfs();
    vfs.setFile("Foo", Buffer.from("A"), "op1");
    vfs.setFile("foo/bar", Buffer.from("B"), "op2");
    expect(() => assertNoCaseCollision(vfs)).toThrow(/类型塌陷/);
  });

  it("仅一个键 → 通过", () => {
    const vfs = createVfs();
    vfs.setFile("Foo.json", Buffer.from("A"), "op1");
    expect(() => assertNoCaseCollision(vfs)).not.toThrow();
  });

  it("不塌陷的同名异路径 → 通过", () => {
    const vfs = createVfs();
    vfs.setFile("a/foo.json", Buffer.from("A"), "op1");
    vfs.setFile("b/foo.json", Buffer.from("B"), "op2");
    dir(vfs, "a");
    dir(vfs, "b");
    expect(() => assertNoCaseCollision(vfs)).not.toThrow();
  });

  it("同名 file 与同名 dir 节点（同大小写）→ 不误报", () => {
    const vfs = createVfs();
    vfs.setFile("a/b.txt", Buffer.from("A"), "op1");
    dir(vfs, "a");
    expect(() => assertNoCaseCollision(vfs)).not.toThrow();
  });
});

describe("[B1] loadBaseDir 整树载入 + 元数据 + exclude", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vfs-base-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("载入文件内容 + mode + 空目录保留 + 默认 exclude .git/node_modules", () => {
    fs.writeFileSync(path.join(root, "a.txt"), "A");
    fs.mkdirSync(path.join(root, "sub"));
    fs.writeFileSync(path.join(root, "sub", "b.txt"), "B");
    fs.mkdirSync(path.join(root, "empty"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, ".git", "config"), "x");
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.writeFileSync(path.join(root, "node_modules", "p.js"), "x");

    const vfs = createVfs();
    loadBaseDir(vfs, root);
    expect(vfs.get("a.txt")?.content?.toString()).toBe("A");
    expect(vfs.get("sub/b.txt")?.content?.toString()).toBe("B");
    expect(vfs.get("empty")?.kind).toBe("dir");
    expect(vfs.has(".git/config")).toBe(false);
    expect(vfs.has("node_modules/p.js")).toBe(false);
  });

  it("symlink → linkTarget", () => {
    fs.writeFileSync(path.join(root, "real.txt"), "R");
    fs.symlinkSync("real.txt", path.join(root, "link.txt"));
    const vfs = createVfs();
    loadBaseDir(vfs, root);
    expect(vfs.get("link.txt")?.kind).toBe("symlink");
    expect(vfs.get("link.txt")?.linkTarget).toBe("real.txt");
  });

  it("来源不存在 → throw", () => {
    expect(() => loadBaseDir(createVfs(), path.join(root, "nope"))).toThrow(
      /不存在/,
    );
  });
});

describe("[B1] flush 原子 swap + 元数据落地", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vfs-flush-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("首次 flush 写入文件 + mode + 空目录 + symlink", () => {
    const out = path.join(root, "out");
    const vfs = createVfs();
    vfs.setFile("a.txt", Buffer.from("A"), "op1");
    vfs.setFile("bin/run.sh", Buffer.from("#!/bin/sh"), "op2", { mode: 0o755 });
    vfs.setNode("emptydir", {
      kind: "dir",
      provenance: { lastOpId: "op3", contributingOpIds: ["op3"] },
    });
    vfs.setNode("link", {
      kind: "symlink",
      linkTarget: "a.txt",
      provenance: { lastOpId: "op4", contributingOpIds: ["op4"] },
    });
    const res = flush(vfs, out);
    expect(fs.readFileSync(path.join(out, "a.txt"), "utf-8")).toBe("A");
    expect(fs.statSync(path.join(out, "bin/run.sh")).mode & 0o777).toBe(0o755);
    expect(fs.statSync(path.join(out, "emptydir")).isDirectory()).toBe(true);
    expect(fs.lstatSync(path.join(out, "link")).isSymbolicLink()).toBe(true);
    expect(res.files).toContain("a.txt");
  });

  it("H1 原子性：materialize 失败（temp 就位前）旧 output 完整保留 + 无半成品/backup 残留", () => {
    const out = path.join(root, "out");
    // 先建立旧 output
    const v1 = createVfs();
    v1.setFile("keep.txt", Buffer.from("OLD"), "op1");
    flush(v1, out);
    expect(fs.readFileSync(path.join(out, "keep.txt"), "utf-8")).toBe("OLD");

    // 第二次 flush：含一个非法 symlink 节点（缺 linkTarget）→ materialize throw
    const v2 = createVfs();
    v2.setFile("new.txt", Buffer.from("NEW"), "op2");
    v2.setNode("bad-link", {
      kind: "symlink",
      provenance: { lastOpId: "op2", contributingOpIds: ["op2"] },
    });
    expect(() =>
      flush(v2, out, {
        prevManifest: { recipeId: "r", output: "out", files: ["keep.txt"] },
      }),
    ).toThrow(/linkTarget/);

    // 旧 output 完整保留（rename/写入失败不丢旧产物）
    expect(fs.readFileSync(path.join(out, "keep.txt"), "utf-8")).toBe("OLD");
    expect(fs.existsSync(path.join(out, "new.txt"))).toBe(false);
    // 无 temp / backup 残留在父目录
    const siblings = fs.readdirSync(root);
    expect(siblings.some((n) => n.includes(".assemble-flush-"))).toBe(false);
    expect(siblings.some((n) => n.includes(".assemble-backup-"))).toBe(false);
  });

  it("H1 成功 flush 后无 backup 残留（三段式收尾删 backup）", () => {
    const out = path.join(root, "out");
    const v1 = createVfs();
    v1.setFile("a.txt", Buffer.from("A"), "op1");
    flush(v1, out);
    const v2 = createVfs();
    v2.setFile("a.txt", Buffer.from("A2"), "op1");
    flush(v2, out, {
      prevManifest: { recipeId: "r", output: "out", files: ["a.txt"] },
    });
    expect(fs.readFileSync(path.join(out, "a.txt"), "utf-8")).toBe("A2");
    expect(
      fs.readdirSync(root).some((n) => n.includes(".assemble-backup-")),
    ).toBe(false);
  });

  it("H1 swapInto 回滚：stage② temp→output 失败 → 旧产物经 backup 复位 + 无残留", () => {
    const out = path.join(root, "out");
    const v1 = createVfs();
    v1.setFile("keep.txt", Buffer.from("OLD"), "op1");
    flush(v1, out);

    // mock renameSync 仅对 temp(.assemble-flush-)→output 抛错（stage②），其余真做
    const realRename = fs.renameSync.bind(fs);
    const spy = vi
      .spyOn(fs, "renameSync")
      .mockImplementation((src: fs.PathLike, dest: fs.PathLike) => {
        if (String(src).includes(".assemble-flush-")) {
          throw new Error("simulated stage② rename failure");
        }
        return realRename(src, dest);
      });
    try {
      const v2 = createVfs();
      v2.setFile("keep.txt", Buffer.from("NEW"), "op2");
      expect(() =>
        flush(v2, out, {
          prevManifest: { recipeId: "r", output: "out", files: ["keep.txt"] },
        }),
      ).toThrow(/stage② rename failure/);
    } finally {
      spy.mockRestore();
    }

    // swapInto catch 路径：旧产物从 backup 复位，新产物未就位
    expect(fs.readFileSync(path.join(out, "keep.txt"), "utf-8")).toBe("OLD");
    // finally 清 temp + backup 复位后无 backup 残留
    const siblings = fs.readdirSync(root);
    expect(siblings.some((n) => n.includes(".assemble-flush-"))).toBe(false);
    expect(siblings.some((n) => n.includes(".assemble-backup-"))).toBe(false);
  });

  it("孤儿删除（manifest 记录但本次不产出）", () => {
    const out = path.join(root, "out");
    const cwd = root;
    // 首次：a + b
    const v1 = createVfs();
    v1.setFile("a.txt", Buffer.from("A"), "op1");
    v1.setFile("b.txt", Buffer.from("B"), "op1");
    const r1 = flush(v1, out);
    writeManifest(cwd, { recipeId: "r", output: "out", files: r1.files });

    // 二次：仅 a（b 成孤儿应删）
    const v2 = createVfs();
    v2.setFile("a.txt", Buffer.from("A2"), "op1");
    const prev = readManifest(cwd, "r");
    flush(v2, out, { prevManifest: prev });
    expect(fs.existsSync(path.join(out, "a.txt"))).toBe(true);
    expect(fs.existsSync(path.join(out, "b.txt"))).toBe(false);
  });

  it("untracked 文件受保护 → 默认 fail（无 --force-clean）", () => {
    const out = path.join(root, "out");
    const v1 = createVfs();
    v1.setFile("a.txt", Buffer.from("A"), "op1");
    const r1 = flush(v1, out);
    // 人为加 untracked 文件（manifest 未记录）
    fs.writeFileSync(path.join(out, "manual.txt"), "M");

    const v2 = createVfs();
    v2.setFile("a.txt", Buffer.from("A2"), "op1");
    expect(() =>
      flush(v2, out, {
        prevManifest: { recipeId: "r", output: "out", files: r1.files },
      }),
    ).toThrow(/untracked|未记录/);
  });

  it("forceClean 需 gitClean 或 allowUntrackedDelete", () => {
    const out = path.join(root, "out");
    const v = createVfs();
    v.setFile("a.txt", Buffer.from("A"), "op1");
    flush(v, out);
    fs.writeFileSync(path.join(out, "manual.txt"), "M");
    const v2 = createVfs();
    v2.setFile("a.txt", Buffer.from("A2"), "op1");
    expect(() => flush(v2, out, { forceClean: true })).toThrow(/git/);
    // allowUntrackedDelete 放行
    expect(() =>
      flush(v2, out, { forceClean: true, allowUntrackedDelete: true }),
    ).not.toThrow();
    expect(fs.existsSync(path.join(out, "manual.txt"))).toBe(false);
  });
});

describe("[B1] manifest 读写落 output 外 .done-coding/generator/assemble/manifests/", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vfs-manifest-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("writeManifest 落 <cwd>/.done-coding/generator/assemble/manifests/<id>.json，readManifest 读回", () => {
    writeManifest(root, { recipeId: "foo", output: "out", files: ["a.txt"] });
    const p = path.join(
      root,
      ".done-coding",
      "generator",
      "assemble",
      "manifests",
      "foo.json",
    );
    expect(fs.existsSync(p)).toBe(true);
    expect(readManifest(root, "foo")?.files).toEqual(["a.txt"]);
    expect(readManifest(root, "missing")).toBeUndefined();
  });
});
