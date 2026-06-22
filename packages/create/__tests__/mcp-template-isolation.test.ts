import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * MCP 模板来源隔离测试（资源核心）
 * ---
 * 规范：MCP 的「模板列表资源」只读本地、不联网、不读家目录全局指针、不读远程默认。
 * 隔离不再由运行时 mode 闸保证（已回退），而是结构性地由 MCP prepare 工具 zod 必填
 * templateUrl + 本资源「取资源时传入 configPath」共同保证。
 *
 * 本文件直接 import 构建产物里的 `readTemplateListResource`（MCP 资源回调的纯核心），
 * 验证：本地列表正确返回、configPath 缺失抛错、文件不存在返回空列表（不抛、不联网）。
 * MCP 层的 prepare zod 必填 + URI round-trip 由 packages/mcp 的测试覆盖。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(TEST_DIR, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "..", "..");
const ES_INDEX = path.resolve(PKG_DIR, "es", "index.mjs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let readTemplateListResource: any;
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
  readTemplateListResource = mod.readTemplateListResource;
  workDir = mkdtempSync(path.join(tmpdir(), "dc-mcp-res-"));
}, 120000);

afterAll(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
  }
});

describe("create 模板列表资源（MCP 资源核心，仅本地不联网）", () => {
  it("本地 { templateList: [...] }：返回该列表，source=local，configPath 透传", async () => {
    const configPath = path.join(workDir, "templates.json");
    const templateList = [
      { name: "本地模板A", url: "/abs/path/to/repo-a" },
      { name: "远端模板B", url: "https://example.com/repo-b.git" },
    ];
    writeFileSync(configPath, JSON.stringify({ templateList }), "utf-8");

    const result = await readTemplateListResource(configPath);
    expect(result.source).toBe("local");
    expect(result.configPath).toBe(configPath);
    expect(result.templateList).toEqual(templateList);
  });

  it("configPath 为空/纯空白：抛错（不静默联网、不回落）", async () => {
    await expect(readTemplateListResource("")).rejects.toThrow();
    await expect(readTemplateListResource("   ")).rejects.toThrow();
  });

  it("configPath 指向不存在的文件：返回空列表（不抛、不联网）", async () => {
    const missing = path.join(workDir, "does-not-exist.json");
    const result = await readTemplateListResource(missing);
    expect(result.source).toBe("local");
    expect(result.templateList).toEqual([]);
  });
});
