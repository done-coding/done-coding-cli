/* eslint-disable no-template-curly-in-string -- fixture 是给生成器解析的字面配置文本，含 ${} 非 JS 插值 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import generatorExtension from "@/extensions/generator";

/**
 * done-coding 工具扩展测试：extension 工厂 → fake pi 捕获 registerTool 注册的工具 →
 * 直接 execute（结构化入参 → 结构化结果），对齐 coding-agent 的 tool-call 执行路径。
 * 全沙盒：夹具落 tmp，afterEach 清理；stdout 洁净断言。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const GENERATOR_ES = path.resolve(
  REPO_ROOT,
  "packages",
  "generator",
  "es",
  "index.mjs",
);

beforeAll(() => {
  if (process.env.DC_SKIP_BUILD !== "1" && !fs.existsSync(GENERATOR_ES)) {
    const build = spawnSync(
      "npx",
      [
        "lerna",
        "run",
        "build",
        "--scope=@done-coding/cli-utils",
        "--scope=@done-coding/cli-generator",
      ],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    if (build.status !== 0) {
      throw new Error(`构建依赖包失败：\n${build.stdout}\n${build.stderr}`);
    }
  }
}, 120000);

/** fake pi：捕获 registerTool 注册的工具定义 */
const captureTools = (): ToolDefinition[] => {
  const tools: ToolDefinition[] = [];
  const fake = {
    registerTool: (tool: ToolDefinition) => {
      tools.push(tool);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generatorExtension(fake as any);
  return tools;
};

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-dex-")),
  );
  tmpRoots.push(dir);
  return dir;
};
afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

/** widget 批次 config（${} 为字面，单引号数组拼接不被插值） */
const WIDGET_CONFIG = [
  "{",
  '  instanceDir: "${execDir}/src/${nameKebab}",',
  "  removeEmptyDir: true,",
  "  rollbackDelNullFile: true,",
  "  rollbackDelAskAsYes: true,",
  '  collectEnvDataForm: [{ name: "desc", message: "desc" }],',
  "  files: [",
  '    { strategy: "create", inputData: "// ${name}: ${desc}", output: "src/${nameKebab}/index.ts" },',
  "  ],",
  "}",
].join("\n");

const writeBatch = (root: string, type: string, configBody: string): void => {
  const dir = path.join(root, ".done-coding", type);
  fs.mkdirSync(path.join(dir, "template"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({ config: "./config.json5" }),
  );
  fs.writeFileSync(path.join(dir, "config.json5"), configBody);
};

/** 构造 execute 的扩展 ctx（仅 cwd 相关字段） */
const extCtx = (cwd: string) => ({ cwd }) as never;

describe("generatorExtension 工具注册", () => {
  it("注册 list/list_questions/add 三工具且 name 全局唯一", () => {
    const tools = captureTools();
    expect(tools.map((t) => t.name)).toEqual([
      "done_coding_gen_list_batches",
      "done_coding_gen_list_questions",
      "done_coding_gen_add",
    ]);
    expect(new Set(tools.map((t) => t.name)).size).toBe(3);
  });

  it("list_batches：枚举 tmp 沙盒内批次", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tool = captureTools().find(
      (t) => t.name === "done_coding_gen_list_batches",
    )!;
    const result = (await tool.execute(
      "call-1",
      {},
      undefined,
      undefined,
      extCtx(root),
    )) as { content: { type: "text"; text: string }[] };
    const items = JSON.parse(result.content[0].text) as Array<{ name: string }>;
    expect(items.some((i) => i.name === "widget")).toBe(true);
  });

  it("list_questions：返回该批次问题清单", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tool = captureTools().find(
      (t) => t.name === "done_coding_gen_list_questions",
    )!;
    const result = (await tool.execute(
      "call-2",
      { type: "widget" },
      undefined,
      undefined,
      extCtx(root),
    )) as { content: { type: "text"; text: string }[] };
    expect(JSON.parse(result.content[0].text)).toEqual([
      { key: "desc", required: true },
    ]);
  });

  it("add：非交互落地实例文件", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tool = captureTools().find((t) => t.name === "done_coding_gen_add")!;
    const result = (await tool.execute(
      "call-3",
      { type: "widget", name: "my-card", envData: { desc: "hi" } },
      undefined,
      undefined,
      extCtx(root),
    )) as { content: { type: "text"; text: string }[] };
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: "ok",
      action: "add",
      type: "widget",
      name: "my-card",
    });
    const out = path.join(root, "src", "my-card", "index.ts");
    expect(fs.readFileSync(out, "utf-8")).toBe("// MyCard: hi");
  });

  it("缺必填参数 execute 抛错（fail-fast 回填给 LLM）", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tool = captureTools().find((t) => t.name === "done_coding_gen_add")!;
    await expect(
      tool.execute("call-4", { name: "x" }, undefined, undefined, extCtx(root)),
    ).rejects.toThrow();
  });
});
