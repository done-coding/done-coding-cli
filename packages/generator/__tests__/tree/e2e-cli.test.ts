/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * [T3-e2e] 真 spawn `es/cli.mjs tree <action>` 端到端。
 *
 * 不 import handler——用 node:child_process spawnSync 拉起构建产物，验证 cli 边界落地：
 *  ① tree build：exit 0 + 产物落 gitRoot 内（模块 spec = assemble Recipe）+ manifest 写入。
 *  ② tree check：build 后 check exit 0（无漂移）；篡改产物后 check exit 1（漂移）；还原过。
 *  ③ 非 git 仓：tree build → 受控非 0 退出 + stderr 可读 fail-loud 错误（signal=null）。
 * 沙盒：夹具落 os.tmpdir + afterEach 清理（项目 CLAUDE.md 铁律），git 仓为临时仓。
 * beforeAll：若 es/cli.mjs 缺失则 `pnpm build` 构建一次（hookTimeout 已 120s）。
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

// 从本测试文件定位 packageRoot（test/tree/ → 上两级）。
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const binPath = path.join(packageRoot, "es", "cli.mjs");

beforeAll(() => {
  // 总是 build：e2e spawn 真 bin，须保证测的是当前源码产物。
  execFileSync("pnpm", ["build"], { cwd: packageRoot, stdio: "inherit" });
  expect(fs.existsSync(binPath)).toBe(true);
});

let fixture: string;
afterEach(() => {
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
});

/** 初始化临时 git 仓（tree 的 gitRoot 锚定前提）。 */
const initGitRepo = (dir: string): void => {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
};

/** 在夹具（git 仓）内写碎片文件。 */
const writeFragment = (rel: string, content: string): void => {
  const abs = path.join(
    fixture,
    ".done-coding",
    "generator",
    "assemble",
    "fragments",
    rel,
  );
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
};

/** 在夹具（git 仓）内写配方文件（模块 spec = assemble Recipe）。 */
const writeRecipe = (name: string, content: string): void => {
  const dir = path.join(
    fixture,
    ".done-coding",
    "generator",
    "assemble",
    "recipes",
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content, "utf-8");
};

/** 自包含夹具：临时 git 仓 + addFragment 页面模板 + writeFile 内联。 */
const scaffoldFixture = (): void => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "tree-e2e-"));
  initGitRepo(fixture);
  writeFragment("Page.vue", "<template><h1>${title}</h1></template>\n");
  writeRecipe(
    "demo-module.json5",
    `{
      id: "demo-module",
      base: { kind: "empty" },
      output: "src/modules/demo",
      render: true,
      vars: { title: "Demo" },
      ops: [
        { type: "addFragment", id: "page", source: "Page.vue", target: "Page.vue" },
        { type: "writeFile", id: "readme", target: "README.md", content: "# demo-module\\n" },
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

describe("[T3-e2e] spawn dc-generator tree build|check", () => {
  it("① tree build：exit 0 + 产物落 gitRoot 内 + manifest 写入", () => {
    scaffoldFixture();
    const r = runCli(["tree", "build"]);
    expect(r.status).toBe(0);
    expect(r.signal).toBe(null);
    const outDir = path.join(fixture, "src", "modules", "demo");
    expect(fs.readFileSync(path.join(outDir, "Page.vue"), "utf-8")).toBe(
      "<template><h1>Demo</h1></template>\n",
    );
    expect(fs.readFileSync(path.join(outDir, "README.md"), "utf-8")).toBe(
      "# demo-module\n",
    );
    expect(
      fs.existsSync(
        path.join(
          fixture,
          ".done-coding",
          "generator",
          "assemble",
          "manifests",
          "demo-module.json",
        ),
      ),
    ).toBe(true);
  });

  it("② tree check：build 后无漂移 exit 0；篡改产物后 exit 1；还原过", () => {
    scaffoldFixture();
    expect(runCli(["tree", "build"]).status).toBe(0);

    const clean = runCli(["tree", "check"]);
    expect(clean.status).toBe(0);

    fs.writeFileSync(
      path.join(fixture, "src", "modules", "demo", "Page.vue"),
      "tampered",
      "utf-8",
    );
    const drift = runCli(["tree", "check"]);
    expect(drift.status).toBe(1);
  });

  it("③ 非 git 仓（plain tmpdir）→ tree build 受控非 0 退出 + fail-loud stderr", () => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), "tree-e2e-nogit-"));
    const r = runCli(["tree", "build"]);
    expect(r.status).not.toBe(0);
    expect(r.signal).toBe(null); // 受控退出，非 SIGABRT/SIGSEGV 崩溃
    expect(r.stderr).toMatch(/不在 git 仓内/);
  });
});
