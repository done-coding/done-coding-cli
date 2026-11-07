/**
 * wgrj68：新项目缺 `.done-coding/component/` 时，list 等命令给出初始化提示而不是调用栈；
 * `--help` 说明初始化方式。
 *
 * spawn 已构建的 dc-component bin；项目与 HOME 均为临时目录（不读真实 ~/.done-coding），用例后清理。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const BIN = path.join(pkgRoot, "es", "cli.mjs");
/** 提示里给出的初始化命令对应的 dc-generator bin（工作区依赖，随依赖链构建） */
const GENERATOR_BIN = path.join(
  pkgRoot,
  "node_modules",
  "@done-coding",
  "cli-generator",
  "es",
  "cli.mjs",
);

const tmpRoots: string[] = [];

const mkProject = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dc-component-missing-"));
  tmpRoots.push(root);
  const project = path.join(root, "project");
  const home = path.join(root, "home");
  fs.mkdirSync(path.join(project, "src"), { recursive: true });
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(project, "package.json"), '{"name":"smoke"}\n');
  return { project, home };
};

const run = (
  args: string[],
  { cwd, home, bin = BIN }: { cwd: string; home: string; bin?: string },
) =>
  spawnSync("node", [bin, ...args], {
    cwd,
    encoding: "utf-8",
    input: "",
    timeout: 30000,
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });

beforeAll(() => {
  if (!fs.existsSync(BIN)) {
    throw new Error(
      `dc-component 未构建：${BIN} 不存在。请先 \`pnpm --filter @done-coding/cli-component build\`（含依赖链）后再跑 test。`,
    );
  }
});

afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

describe("缺少 .done-coding/component/ 配置", () => {
  it("list：非 0 退出，说明缺什么与如何初始化，不打印调用栈", () => {
    const { project, home } = mkProject();
    const r = run(["list"], { cwd: project, home });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(".done-coding/component/");
    expect(r.stderr).toContain("generator init component");
    expect(r.stderr).not.toMatch(/^\s+at /m);
    // 只读命令：不得顺手在项目里生成配置
    expect(fs.existsSync(path.join(project, ".done-coding"))).toBe(false);
  });

  it("按提示运行 generator init component 后，list 正常结束", () => {
    const { project, home } = mkProject();
    const init = run(["init", "component"], {
      cwd: project,
      home,
      bin: GENERATOR_BIN,
    });
    expect(init.status).toBe(0);
    const r = run(["list"], { cwd: project, home });
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain("未找到批次类型");
  });

  it("--help：说明初始化方式", () => {
    const { project, home } = mkProject();
    const r = run(["--help"], { cwd: project, home });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("generator init component");
  });
});
