/**
 * tree / assemble 越界判定解开符号链接：落地、碎片读取、base 来源都不能经链接越出各自边界；
 * 全局层模板目录本身是指向模板仓的软链（分发方式）时照常可用。
 * 沙盒：fixtures 落 os.tmpdir() + afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Recipe } from "@/assemble/types";
import { runBuild, type EngineCtx } from "@/assemble/engine";
import { createVfs, flush } from "@/assemble/vfs";
import { unregisterAll } from "@/assemble/registry";

let scratch: string;
let project: string;
let outside: string;
let ctx: EngineCtx;

const fragments = () =>
  path.join(project, ".done-coding", "generator", "assemble", "fragments");
const outsideEntries = () => fs.readdirSync(outside).sort();
const addFragmentRecipe = (source: string, output = "out"): Recipe => ({
  id: "r",
  base: { kind: "empty" },
  output,
  ops: [{ type: "addFragment", id: "a", source, target: "a.txt" }],
});

beforeEach(() => {
  unregisterAll();
  scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "esc-")));
  project = path.join(scratch, "project");
  outside = path.join(scratch, "outside");
  fs.mkdirSync(fragments(), { recursive: true });
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "secret.txt"), "secret");
  fs.writeFileSync(path.join(fragments(), "ok.txt"), "ok");
  ctx = { cwd: project };
});
afterEach(() => {
  unregisterAll();
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe("tree / assemble 越界判定解开符号链接", () => {
  it("output 经项目内指向外部的目录链接 → 拒绝，产物不落到项目外", () => {
    fs.symlinkSync(outside, path.join(project, "linked"));
    expect(() =>
      runBuild(addFragmentRecipe("ok.txt", "linked/out"), ctx),
    ).toThrow(/recipe\.output .*越出 cwd/);
    expect(outsideEntries()).toEqual(["secret.txt"]);
  });

  it("落地树里的软链节点不能让其下的文件写到落地目录之外", () => {
    const vfs = createVfs();
    vfs.setNode("a", {
      kind: "symlink",
      linkTarget: outside,
      provenance: { lastOpId: "t", contributingOpIds: ["t"] },
    });
    vfs.setFile("a/x.txt", Buffer.from("x"), "t");
    expect(() => flush(vfs, path.join(project, "out"))).toThrow(
      /VFS 路径 .*越出 落地目录/,
    );
    expect(outsideEntries()).toEqual(["secret.txt"]);
    expect(fs.existsSync(path.join(project, "out"))).toBe(false);
  });

  it("碎片文件链到模板目录之外且按内容读取（deref）→ 拒绝，不把外部文件读进产物", () => {
    fs.mkdirSync(path.join(fragments(), "tpl"));
    fs.symlinkSync(
      path.join(outside, "secret.txt"),
      path.join(fragments(), "tpl", "evil.txt"),
    );
    fs.symlinkSync(
      path.join(outside, "secret.txt"),
      path.join(fragments(), "top-evil.txt"),
    );
    for (const source of ["tpl/evil.txt", "top-evil.txt"]) {
      const recipe: Recipe = {
        ...addFragmentRecipe(source),
        ops: [
          {
            type: "addFragment",
            id: "a",
            source,
            target: "a.txt",
            symlinkPolicy: "deref",
          },
        ],
      };
      expect(() => runBuild(recipe, ctx)).toThrow(/碎片 .*越出 模板目录/);
    }
    expect(fs.existsSync(path.join(project, "out"))).toBe(false);
  });

  it("模板目录本身是指向模板仓的软链（全局层分发）→ 照常生成", () => {
    const hubTemplate = path.join(scratch, "hub", "module-templates", "tpl");
    fs.mkdirSync(hubTemplate, { recursive: true });
    fs.writeFileSync(path.join(hubTemplate, "page.txt"), "from hub");
    fs.symlinkSync(hubTemplate, path.join(fragments(), "tpl"));
    runBuild(addFragmentRecipe("tpl/page.txt"), ctx);
    expect(fs.readFileSync(path.join(project, "out", "a.txt"), "utf-8")).toBe(
      "from hub",
    );
  });

  it("base.from 是指向外部的链接 → 拒绝整树读入", () => {
    fs.symlinkSync(outside, path.join(project, "base-link"));
    const recipe: Recipe = {
      ...addFragmentRecipe("ok.txt"),
      base: { kind: "dir", from: "base-link" },
    };
    expect(() => runBuild(recipe, ctx)).toThrow(/base\.from .*越出 cwd/);
    expect(fs.existsSync(path.join(project, "out"))).toBe(false);
  });
});
