import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runInstructions } from "@/core/instructions";
import { getConfigPath } from "@/core/config";
import { handler as check } from "@/handlers/check";
import { handler as instructions } from "@/handlers/instructions";
import { writeLists } from "@/core/lists";
import { cleanup } from "./helpers";

let root = "";
afterEach(() => {
  vi.restoreAllMocks();
  cleanup(root);
});
const write = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
const setup = (files: Record<string, string> = {}) => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-instructions-"));
  execFileSync("git", ["init", "-q", root]);
  for (const [file, text] of Object.entries(files)) write(file, text);
  execFileSync("git", ["add", "--", "."], { cwd: root });
};
const pair = (dir: string, text: string) => ({
  [`${dir}AGENTS.md`]: text,
  [`${dir}CLAUDE.md`]: "\n@AGENTS.md\n",
});

describe("runInstructions", () => {
  it("全过、按 UTF-8 字节计数；等于预算不报错，忽略未跟踪指令", () => {
    setup({ ...pair("", "中文"), ...pair("a/", "abc") });
    write("untracked/AGENTS.md", "x".repeat(40000));
    const result = runInstructions(root, {
      budget: { root: 6, nested: 3, chain: 9 },
    });
    expect(result.errors).toEqual([]);
    expect(result.files).toEqual([
      { file: "AGENTS.md", bytes: 6 },
      { file: "a/AGENTS.md", bytes: 3 },
    ]);
  });
  it("分别检查根与子层单文件预算", () => {
    setup({ ...pair("", "1234"), ...pair("a/", "123") });
    expect(
      runInstructions(root, { budget: { root: 3, nested: 2 } }).errors,
    ).toEqual([
      "AGENTS.md：实际 4 B，预算 3 B，超出 1 B",
      "a/AGENTS.md：实际 3 B，预算 2 B，超出 1 B",
    ]);
  });
  it("多层链路跨过无指令目录，列贡献者，不混入兄弟层", () => {
    setup({
      ...pair("", "123"),
      ...pair("a/", "12345"),
      ...pair("a/gap/b/", "1234"),
      ...pair("ab/", "12"),
    });
    expect(runInstructions(root, { budget: { chain: 10 } }).errors).toEqual([
      "a/gap/b/AGENTS.md 链路：实际 12 B，预算 10 B，超出 2 B；沿途 AGENTS.md=3 B → a/AGENTS.md=5 B → a/gap/b/AGENTS.md=4 B；最大贡献者 a/AGENTS.md=5 B",
    ]);
  });
  it("exclude 支持 Git glob 的 **、*、?、字符组，排除项不计预算", () => {
    setup({
      ...pair("", "ok"),
      "fragments/a/b/AGENTS.md": "x",
      "skills/a1/CLAUDE.md": "正文",
    });
    expect(runInstructions(root).errors).toHaveLength(2);
    expect(
      runInstructions(root, { exclude: ["fragments/**", "skills/[a-z]?/*"] })
        .errors,
    ).toEqual([]);
  });
  it("缺少跟踪 CLAUDE 即违规，未跟踪入口不能让闸变绿", () => {
    setup({ "AGENTS.md": "ok" });
    write("CLAUDE.md", "@AGENTS.md\n");
    expect(runInstructions(root).errors).toEqual([
      "CLAUDE.md：缺少同级跟踪的普通兼容入口",
    ]);
  });
  it("拒绝 CLAUDE 软链（包括断链）", () => {
    setup({ "AGENTS.md": "ok" });
    fs.symlinkSync("missing", path.join(root, "CLAUDE.md"));
    execFileSync("git", ["add", "--", "CLAUDE.md"], { cwd: root });
    expect(runInstructions(root).errors).toEqual([
      "CLAUDE.md：须为普通文件（非软链）",
    ]);
  });
  it("首个非空行必须精确导入，允许 Claude 专属增量", () => {
    setup({ ...pair("", "ok"), "CLAUDE.md": "正文\n@AGENTS.md\n" });
    expect(runInstructions(root).errors).toEqual([
      "CLAUDE.md：首个非空行须为 @AGENTS.md",
    ]);
    write("CLAUDE.md", "\n@AGENTS.md\n专属增量\n");
    expect(runInstructions(root).errors).toEqual([]);
  });
  it("无 AGENTS 的 CLAUDE 正文违规，单行纯导入保留", () => {
    setup({ "CLAUDE.md": "正文", "legacy/CLAUDE.md": "\n@../AGENTS.md\n" });
    expect(runInstructions(root).errors).toEqual([
      "CLAUDE.md：正文仍在 CLAUDE.md（无同级 AGENTS.md）",
    ]);
  });
  it("失踪跟踪文件报错，拒绝 AGENTS 软链", () => {
    setup(pair("", "ok"));
    fs.unlinkSync(path.join(root, "AGENTS.md"));
    expect(runInstructions(root).errors[0]).toContain("无法读取");
    fs.symlinkSync("CLAUDE.md", path.join(root, "AGENTS.md"));
    expect(runInstructions(root).errors[0]).toContain("非软链");
  });
  it("拒绝子目录启动、非法预算与 exclude", () => {
    setup(pair("", "ok"));
    fs.mkdirSync(path.join(root, "sub"));
    expect(() => runInstructions(path.join(root, "sub"))).toThrow("cwd-only");
    expect(() => runInstructions(root, { budget: { root: -1 } })).toThrow(
      "非负安全整数",
    );
    expect(() => runInstructions(root, { exclude: [""] })).toThrow("glob");
  });
  it("JSON 可解析且退出码遵循结果，无需治理目录", async () => {
    setup(pair("", "ok"));
    vi.spyOn(process, "cwd").mockReturnValue(root);
    const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(await instructions({ json: true } as never)).toBe(0);
    expect(JSON.parse(String(output.mock.calls[0][0])).errors).toEqual([]);
    write("CLAUDE.md", "wrong");
    expect(await instructions({ json: true } as never)).toBe(1);
    expect(JSON.parse(String(output.mock.calls[1][0])).errors).toHaveLength(1);
  });
  it("check 默认和 gate false 不检查，gate true 影响退出码", async () => {
    setup({ "AGENTS.md": "ok" });
    write("docs/governance/MODULES.md", "| `harness` | x |\n");
    writeLists(path.join(root, "docs/governance"));
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(await check({} as never)).toBe(0);
    const config = path.relative(root, getConfigPath(root));
    write(config, JSON.stringify({ instructions: { gate: false } }));
    expect(await check({} as never)).toBe(0);
    write(config, JSON.stringify({ instructions: { gate: true } }));
    expect(await check({} as never)).toBe(1);
    write(
      config,
      JSON.stringify({ instructions: { gate: true, exclude: ["AGENTS.md"] } }),
    );
    expect(await check({} as never)).toBe(0);
  });
});
