/**
 * [T4] 注入编排单测（assemble/inject）：复用 textPatchHandler + template marker 引擎。
 *
 * 覆盖：幂等成对块 / 新键创建 + 既有块内再注入 / 锚点多命中 fail-loud（D-M4）/
 * 目标越界 gitRoot / 目标不存在 fail-loud / compute 抛错零落盘 / commit 原子落盘 + mode 保留 /
 * 实际渲染锚点形态（`// === dc-generator:start:<key> ===`，已实证）。
 * 沙盒：gitRoot=tmpdir（git 仓，镜像 tree 真实场景），afterEach 清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  applyInjections,
  commitInjections,
  computeInjections,
  type InjectionPlan,
} from "@/assemble/inject/inject";
import { unregisterAll } from "@/assemble/registry";
import type { TextPatchOp } from "@/assemble/types";

let root: string;
let fragRoot: string;
beforeEach(() => {
  unregisterAll();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "inject-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  fragRoot = path.join(
    root,
    ".done-coding",
    "generator",
    "assemble",
    "fragments",
  );
  fs.mkdirSync(fragRoot, { recursive: true });
});
afterEach(() => {
  unregisterAll();
  fs.rmSync(root, { recursive: true, force: true });
});

/** 写 gitRoot 相对项目文件。 */
const writeFile = (rel: string, content: string): void => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

const readFile = (rel: string): string =>
  fs.readFileSync(path.join(root, rel), "utf-8");

/** 写注入源碎片（fragmentRoot 内）。 */
const frag = (rel: string, content: string): void => {
  fs.writeFileSync(path.join(fragRoot, rel), content, "utf-8");
};

const opts = (): {
  gitRoot: string;
  vars: Record<string, unknown>;
  fragmentRoot: string;
} => ({
  gitRoot: root,
  vars: { route: "home" },
  fragmentRoot: fragRoot,
});

const op = (over: Partial<TextPatchOp>): TextPatchOp =>
  ({
    type: "textPatch",
    id: "home-route",
    source: "route.ts",
    target: "src/router/index.ts",
    markerKey: "home-route",
    ...over,
  }) as TextPatchOp;

describe("[T4] assemble/inject 注入编排", () => {
  it("幂等：既有成对块原位替换不重复（build 两次 → 单块）", () => {
    writeFile("src/router/index.ts", "import x\nconst routes = []\n");
    frag("route.ts", "import Home from '@/views/Home.vue'\n");
    const o = op({
      anchor: { pattern: "const routes = []", position: "after" },
    });
    applyInjections([o], opts());
    // 第二次内容变化 → 原位替换
    frag("route.ts", "import About from '@/views/About.vue'\n");
    applyInjections([o], opts());

    const content = readFile("src/router/index.ts");
    expect(
      content.match(/=== dc-generator:start:home-route ===/g)?.length,
    ).toBe(1);
    expect(content).toContain("import About from '@/views/About.vue'");
    expect(content).not.toContain("import Home");
    expect(content).toContain("// === dc-generator:start:home-route ===");
    expect(content).toContain("// === dc-generator:end:home-route ===");
  });

  it("新键创建块 + 既有块内再注入另一键（成对不冲突）", () => {
    writeFile("src/router/index.ts", "A\nB\nC\n");
    frag("f1.ts", "LINE1\n");
    frag("f2.ts", "LINE2\n");
    applyInjections(
      [
        op({
          id: "k1",
          markerKey: "k1",
          source: "f1.ts",
          anchor: { pattern: "A", position: "after" },
        }),
      ],
      opts(),
    );
    // k2 锚点落在 k1 块内（LINE1）→ 块内再注入
    applyInjections(
      [
        op({
          id: "k2",
          markerKey: "k2",
          source: "f2.ts",
          anchor: { pattern: "LINE1", position: "after" },
        }),
      ],
      opts(),
    );
    const content = readFile("src/router/index.ts");
    expect(content).toContain("LINE1");
    expect(content).toContain("LINE2");
    expect(content.match(/=== dc-generator:start:k1 ===/g)?.length).toBe(1);
    expect(content.match(/=== dc-generator:start:k2 ===/g)?.length).toBe(1);
    const start1 = content.indexOf("=== dc-generator:start:k1 ===");
    const end1 = content.indexOf("=== dc-generator:end:k1 ===");
    const start2 = content.indexOf("=== dc-generator:start:k2 ===");
    // k2 块落在 k1 块区间内（start1 < start2 < end1）
    expect(start1).toBeGreaterThan(-1);
    expect(start2).toBeGreaterThan(start1);
    expect(start2).toBeLessThan(end1);
  });

  it("锚点多命中默认 fail-loud（D-M4）", () => {
    writeFile("src/router/index.ts", "anchor\nfoo\nanchor\n");
    frag("route.ts", "X");
    expect(() =>
      applyInjections(
        [op({ anchor: { pattern: "anchor", position: "after" } })],
        opts(),
      ),
    ).toThrow(/多命中/);
    // fail-loud 不改动原文件
    expect(readFile("src/router/index.ts")).toBe("anchor\nfoo\nanchor\n");
  });

  it("注入目标越界 gitRoot（.. 逃逸）→ fail-loud", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "inject-outside-"));
    try {
      fs.mkdirSync(path.join(outside, "dir"), { recursive: true });
      fs.writeFileSync(path.join(outside, "dir", "x.ts"), "x", "utf-8");
      frag("route.ts", "X");
      expect(() =>
        applyInjections(
          [op({ target: "../" + path.basename(outside) + "/dir/x.ts" })],
          opts(),
        ),
      ).toThrow(/越界 gitRoot/);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("注入目标不存在 → fail-loud（不静默创建）", () => {
    frag("route.ts", "X");
    expect(() =>
      applyInjections([op({ target: "src/not-there.ts" })], opts()),
    ).toThrow(/不存在/);
  });

  it("原子性：compute 抛错 → 零落盘（原文件/页面/注入均不动）", () => {
    const original = "anchor\nfoo\nanchor\n";
    writeFile("src/router/index.ts", original);
    frag("route.ts", "X");
    // 锚点多命中 → computeInjections 抛错（commit 未执行 → 无落盘）
    expect(() =>
      computeInjections(
        [op({ anchor: { pattern: "anchor", position: "after" } })],
        opts(),
      ),
    ).toThrow(/多命中/);
    expect(readFile("src/router/index.ts")).toBe(original);
  });

  it("commitInjections 逐文件原子落盘 + 保留原 mode", () => {
    writeFile("src/router/index.ts", "const routes = []\n");
    frag("route.ts", "IMPORT\n");
    const plan = computeInjections(
      [op({ anchor: { pattern: "const routes = []", position: "after" } })],
      opts(),
    );
    expect(plan.files.length).toBe(1);
    expect(plan.files[0].rel).toBe("src/router/index.ts");
    commitInjections(plan, { gitRoot: root });
    const content = readFile("src/router/index.ts");
    expect(content).toContain("IMPORT");
    expect(
      content.match(/=== dc-generator:start:home-route ===/g)?.length,
    ).toBe(1);
  });

  it("commit 阶段 symlink 中间目录越界 → fail-loud 且不预建越界目录（评审 Minor-2）", () => {
    // 构造提交计划：rel 的中间目录是指向 gitRoot 外部的 symlink
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "inject-outside2-"));
    try {
      fs.mkdirSync(path.join(root, "src"), { recursive: true });
      fs.symlinkSync(outside, path.join(root, "src", "link"));
      const plan: InjectionPlan = {
        files: [{ rel: "src/link/child/x.ts", content: Buffer.from("x") }],
      };
      expect(() => commitInjections(plan, { gitRoot: root })).toThrow(
        /越界 gitRoot/,
      );
      // guard 先于 mkdir → 越界处未被递归 mkdir 预建空目录
      expect(fs.existsSync(path.join(outside, "child"))).toBe(false);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("markerKey 缺省 = op.id（未显式 markerKey）", () => {
    writeFile("src/router/index.ts", "A\n");
    frag("route.ts", "X");
    const bare: TextPatchOp = {
      type: "textPatch",
      id: "home-route",
      source: "route.ts",
      target: "src/router/index.ts",
      anchor: { pattern: "A", position: "after" },
    };
    applyInjections([bare], opts());
    expect(readFile("src/router/index.ts")).toContain(
      "// === dc-generator:start:home-route ===",
    );
  });
});
