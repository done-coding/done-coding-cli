/**
 * post-render 格式化钩子单测（recipe.format = "prettier"）。
 *
 * 用 stub 格式化器（node 脚本，见 makeStubFormatter）替代真 prettier（EngineCtx.formatterBin
 * 注入）——测的是管道行为（VFS 变换时机 / build-diff 同径 / 跳过与 fail-loud 分支），
 * 不依赖 prettier 本体版本。沙盒：一切落 os.tmpdir，用例后清理。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Recipe } from "@/assemble/types";
import { runBuild, runDiff, type EngineCtx } from "@/assemble/engine";
import { formatVfs, resolvePrettierBin } from "@/assemble/format";
import { createVfs } from "@/assemble/vfs";
import { unregisterAll } from "@/assemble/registry";

/**
 * stub 格式化器：stdin → stdout。
 *  - `.ts` 文件：行尾追加 " // fmt"（可观察的确定性变换）；
 *  - `.bin` 文件：stderr 输出 no-parser 特征串 + exit 2（模拟 prettier 未知类型）；
 *  - `.bad` 文件：stderr 输出语法错误 + exit 2（模拟生成物损坏）。
 */
const makeStubFormatter = (dir: string): string => {
  const script = path.join(dir, "stub-prettier.cjs");
  fs.writeFileSync(
    script,
    [
      "const chunks = [];",
      "process.stdin.on('data', (c) => chunks.push(c));",
      "process.stdin.on('end', () => {",
      "  const file = process.argv[process.argv.indexOf('--stdin-filepath') + 1];",
      "  const text = Buffer.concat(chunks).toString('utf-8');",
      "  if (file.endsWith('.bin')) {",
      "    process.stderr.write('[error] No parser could be inferred for file: ' + file);",
      "    process.exit(2);",
      "  }",
      "  if (file.endsWith('.bad')) {",
      "    process.stderr.write('[error] SyntaxError: Unexpected token');",
      "    process.exit(2);",
      "  }",
      "  process.stdout.write(text.replace(/\\n/g, ' // fmt\\n'));",
      "});",
    ].join("\n"),
  );
  // 直接可执行的 shim（execFileSync 不经 shell）
  const bin = path.join(dir, "stub-prettier");
  fs.writeFileSync(bin, `#!/usr/bin/env node\n${fs.readFileSync(script)}`);
  fs.chmodSync(bin, 0o755);
  return bin;
};

const recipeOf = (over: Partial<Recipe>): Recipe => ({
  id: "fmt-r",
  base: { kind: "empty" },
  output: "out",
  ops: [
    { type: "writeFile", id: "a", target: "a.ts", content: "const a = 1;\n" },
  ],
  ...over,
});

describe("formatVfs（单元）", () => {
  let root: string;
  let bin: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "fmt-"));
    bin = makeStubFormatter(root);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("无 format 声明 = no-op", () => {
    const vfs = createVfs();
    vfs.setFile("a.ts", Buffer.from("x\n"), "a");
    formatVfs(recipeOf({}), vfs, { cwd: root, formatterBin: bin });
    expect(vfs.get("a.ts")?.content?.toString()).toBe("x\n");
  });

  it("format:prettier → 文件内容经格式化器变换，mode 保留", () => {
    const vfs = createVfs();
    vfs.setFile("a.ts", Buffer.from("x\n"), "a", { mode: 0o755 });
    formatVfs(recipeOf({ format: "prettier" }), vfs, {
      cwd: root,
      formatterBin: bin,
    });
    expect(vfs.get("a.ts")?.content?.toString()).toBe("x // fmt\n");
    expect(vfs.get("a.ts")?.mode).toBe(0o755);
  });

  it("无 parser 的文件静默跳过（内容不变）", () => {
    const vfs = createVfs();
    vfs.setFile("img.bin", Buffer.from([1, 2, 3]), "a");
    formatVfs(recipeOf({ format: "prettier" }), vfs, {
      cwd: root,
      formatterBin: bin,
    });
    expect(vfs.get("img.bin")?.content).toEqual(Buffer.from([1, 2, 3]));
  });

  it("其它格式化错误 fail-loud（生成物疑似语法损坏）", () => {
    const vfs = createVfs();
    vfs.setFile("x.bad", Buffer.from("oops"), "a");
    expect(() =>
      formatVfs(recipeOf({ format: "prettier" }), vfs, {
        cwd: root,
        formatterBin: bin,
      }),
    ).toThrow(/格式化失败/);
  });

  it("声明 format 但目标项目无 prettier → fail-loud", () => {
    expect(() => resolvePrettierBin(root)).toThrow(/未安装 prettier/);
  });
});

describe("engine 集成（build/diff 同径）", () => {
  let cwd: string;
  let bin: string;
  let ctx: EngineCtx;
  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fmt-int-"));
    bin = makeStubFormatter(cwd);
    ctx = { cwd, formatterBin: bin };
  });
  afterEach(() => {
    unregisterAll();
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("runBuild 落盘的是格式化后内容；runDiff 对其零漂移（漂移闸基线一致）", () => {
    const recipe = recipeOf({ format: "prettier" });
    runBuild(recipe, ctx);
    expect(fs.readFileSync(path.join(cwd, "out", "a.ts"), "utf-8")).toBe(
      "const a = 1; // fmt\n",
    );
    const diff = runDiff(recipe, ctx);
    expect(diff.drifted).toBe(false);
  });

  it("人工改格式（去掉格式化标记）→ runDiff 检出漂移", () => {
    const recipe = recipeOf({ format: "prettier" });
    runBuild(recipe, ctx);
    fs.writeFileSync(path.join(cwd, "out", "a.ts"), "const a = 1;\n");
    const diff = runDiff(recipe, ctx);
    expect(diff.drifted).toBe(true);
  });

  it("无 format 的配方 build 内容原样（回归：钩子不误伤存量路径）", () => {
    const recipe = recipeOf({});
    runBuild(recipe, ctx);
    expect(fs.readFileSync(path.join(cwd, "out", "a.ts"), "utf-8")).toBe(
      "const a = 1;\n",
    );
  });
});
