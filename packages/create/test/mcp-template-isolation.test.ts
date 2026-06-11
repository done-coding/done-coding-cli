import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * MCP 模板来源隔离测试
 * ---
 * 规范：MCP 模式下模板来源 [MUST] 经 list 工具显式提供 templateUrl，
 * [MUST NOT] 读取 CLI 的 --templateConfig / 家目录全局配置 / 远程默认列表（不联网）。
 * 本测试直接 import 构建产物里的 prepareCreateProject，验证 MCP ctx 下无 templateUrl 即抛闸，
 * 在触达任何全局/远程/网络解析之前失败。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(TEST_DIR, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "..", "..");
const ES_INDEX = path.resolve(PKG_DIR, "es", "index.mjs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prepareCreateProject: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FormNameEnum: any;
let workDir: string;

beforeAll(async () => {
  if (process.env.DC_SKIP_BUILD !== "1" && !existsSync(ES_INDEX)) {
    const build = spawnSync(
      "npx",
      [
        "lerna",
        "run",
        "build",
        "--scope=@done-coding/cli-utils",
        "--scope=@done-coding/cli-template",
        "--scope=create-done-coding",
      ],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    if (build.status !== 0) {
      throw new Error(`构建被测包失败：\n${build.stdout}\n${build.stderr}`);
    }
  }
  if (!existsSync(ES_INDEX)) {
    throw new Error(`未找到产物 ${ES_INDEX}，请先构建`);
  }
  const mod = await import(pathToFileURL(ES_INDEX).href);
  prepareCreateProject = mod.prepareCreateProject;
  FormNameEnum = mod.FormNameEnum;
  workDir = mkdtempSync(path.join(tmpdir(), "dc-mcp-iso-"));
}, 120000);

afterAll(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
  }
});

describe("MCP 模板来源隔离", () => {
  it("MCP 模式 + 无 templateUrl：抛 MCP guard（不读全局/远程、不联网）", async () => {
    await expect(
      prepareCreateProject(
        { [FormNameEnum.PROJECT_NAME]: "mcpprobe" },
        { mode: "mcp", interactive: false, cwd: workDir },
      ),
    ).rejects.toThrow(/MCP/);
  });

  it("MCP 模式 + 无 templateUrl：未在 cwd 下生成任何项目目录（闸在物化前触发）", async () => {
    await prepareCreateProject(
      { [FormNameEnum.PROJECT_NAME]: "mcpprobe2" },
      { mode: "mcp", interactive: false, cwd: workDir },
    ).catch(() => undefined);
    expect(existsSync(path.join(workDir, "mcpprobe2"))).toBe(false);
  });
});
