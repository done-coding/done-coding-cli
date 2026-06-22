/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * [C3-e2e] 真 spawn `es/cli.mjs assemble <action>` 端到端（该包首条 spawn-bin e2e）。
 *
 * 不 import handler——用 node:child_process spawnSync 拉起构建产物，验证 cli 边界落地：
 *  ① plan --json：exit 0 + stdout 洁净 JSON（可 JSON.parse），列出有序 op 计划。
 *  ② build：exit 0 + output 按配方落地（断言产物内容）。
 *  ③ check：build 后 check exit 0（无漂移）；篡改产物后 check exit 1（漂移）。
 *  ④ 错误路径：缺 recipe / 非法配方 → 受控非 0 退出 + stderr 可读错误（signal=null，非崩溃信号）。
 * 沙盒：夹具落 os.tmpdir + afterEach 清理（项目 CLAUDE.md 铁律），output 落夹具内。
 * beforeAll：若 es/cli.mjs 缺失则 `pnpm build` 构建一次（hookTimeout 已 120s）。
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

// 从本测试文件定位 packageRoot（test/assemble/ → 上两级）。
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const binPath = path.join(packageRoot, "es", "cli.mjs");

beforeAll(() => {
  if (!fs.existsSync(binPath)) {
    execFileSync("pnpm", ["build"], { cwd: packageRoot, stdio: "inherit" });
  }
  expect(fs.existsSync(binPath)).toBe(true);
});

let fixture: string;
afterEach(() => {
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
});

/** 在夹具内写碎片文件。 */
const writeFragment = (rel: string, content: string): void => {
  const abs = path.join(fixture, "assemble", "fragments", rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

/** 在夹具内写配方文件。 */
const writeRecipe = (name: string, content: string): void => {
  const dir = path.join(fixture, "assemble", "recipes");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content, "utf-8");
};

/** 自包含夹具：addFragment 一个文本 + addFragment 一个 package.json + jsonMerge overlay。 */
const scaffoldFixture = (): void => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "asm-e2e-"));
  writeFragment("hi.txt", "hello ${name}\n");
  writeFragment("pkg.json", '{"name":"${name}","version":"1.0.0"}');
  writeFragment("overlay.json", '{"scripts":{"build":"tsc"}}');
  writeRecipe(
    "demo.json5",
    `{
      id: "demo",
      base: { kind: "empty" },
      output: "out",
      vars: { name: "world" },
      ops: [
        { type: "addFragment", id: "hi", source: "hi.txt", target: "hi.txt" },
        { type: "addFragment", id: "pk", source: "pkg.json", target: "package.json" },
        { type: "jsonMerge", id: "ov", source: "overlay.json", target: "package.json" },
      ],
    }`,
  );
};

interface RunResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/** spawnSync 真实 bin（cwd=夹具，非 shell，捕获 status/signal/stdout/stderr）。 */
const runCli = (args: string[]): RunResult => {
  const r = spawnSync(process.execPath, [binPath, ...args], {
    cwd: fixture,
    encoding: "utf-8",
  });
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
};

describe("[C3-e2e] spawn dc-gen assemble <action>", () => {
  it("① plan --json：exit 0 + stdout 洁净 JSON（有序 op 计划）", () => {
    scaffoldFixture();
    const r = runCli(["assemble", "plan", "--json"]);
    expect(r.status).toBe(0);
    expect(r.signal).toBe(null);
    const parsed = JSON.parse(r.stdout) as Array<{
      recipeId: string;
      items: Array<{ id: string; type: string; target: string }>;
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].recipeId).toBe("demo");
    expect(parsed[0].items.map((i) => i.id)).toEqual(["hi", "pk", "ov"]);
  });

  it("② build：exit 0 + output 按配方落地（产物内容断言）", () => {
    scaffoldFixture();
    const r = runCli(["assemble", "build"]);
    expect(r.status).toBe(0);
    const outDir = path.join(fixture, "out");
    expect(fs.readFileSync(path.join(outDir, "hi.txt"), "utf-8")).toBe(
      "hello world\n",
    );
    const pkg = JSON.parse(
      fs.readFileSync(path.join(outDir, "package.json"), "utf-8"),
    ) as { name: string; scripts: Record<string, string> };
    expect(pkg.name).toBe("world");
    expect(pkg.scripts.build).toBe("tsc");
  });

  it("③ check：build 后无漂移 exit 0；篡改产物后 exit 1", () => {
    scaffoldFixture();
    expect(runCli(["assemble", "build"]).status).toBe(0);

    const clean = runCli(["assemble", "check"]);
    expect(clean.status).toBe(0);

    fs.writeFileSync(path.join(fixture, "out", "hi.txt"), "tampered", "utf-8");
    const drift = runCli(["assemble", "check"]);
    expect(drift.status).toBe(1);
  });

  it("④a 缺 recipe → 受控非 0 退出 + 可读 stderr（非崩溃信号）", () => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "asm-e2e-"));
    const r = runCli(["assemble", "plan"]);
    expect(r.status).not.toBe(0);
    expect(r.signal).toBe(null); // 受控退出，非 SIGABRT/SIGSEGV 崩溃
    expect(r.stderr).toMatch(/配方/);
  });

  it("④b 非法配方（JSON5 坏）→ 受控非 0 退出 + 可读 stderr", () => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "asm-e2e-"));
    writeRecipe("bad.json5", "{ id: ");
    const r = runCli(["assemble", "plan"]);
    expect(r.status).not.toBe(0);
    expect(r.signal).toBe(null);
    expect(r.stderr).toMatch(/解析失败/);
  });
});
