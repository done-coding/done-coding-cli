/* eslint-disable no-template-curly-in-string */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  updateEnvConfig,
  processIsHijacked,
  isAllowOutputConsole,
} from "@done-coding/cli-utils";
import {
  registerGeneratorTools,
  addInputSchema,
  listBatchesInputSchema,
  initInputSchema,
  buildGeneratePromptText,
} from "@/handlers";
import { applyMcpEnvConfig } from "@/main";

/**
 * dc-gen MCP 工具接线测试（P3，design §5/§12）。
 *
 * - fake server 捕获 registerTool 的 handler 直接调用（不起真 stdio server）。
 * - 模拟 MCP：updateEnvConfig({consoleLog:false})——outputConsole 切日志、不污染 stdout。
 * - B5 stdout 洁净：spy process.stdout.write，断言工具调用期间零直写。
 * - 全沙盒：夹具落 tmp，afterEach 清理。
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
        "--scope=@done-coding/cli-template",
        "--scope=@done-coding/cli-generator",
      ],
      { cwd: REPO_ROOT, encoding: "utf-8" },
    );
    if (build.status !== 0) {
      throw new Error(`构建依赖包失败：\n${build.stdout}\n${build.stderr}`);
    }
  }
  // 模拟 MCP server 启动：静默控制台（outputConsole 切日志，不写 stdout）
  updateEnvConfig({ series: "mcp", consoleLog: false });
}, 120000);

/** fake server：捕获各工具 handler */
type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: { type: "text"; text: string }[];
}>;
const captureTools = (): Map<string, ToolHandler> => {
  const tools = new Map<string, ToolHandler>();
  const fake = {
    registerTool: (name: string, _def: unknown, handler: ToolHandler) => {
      tools.set(name, handler);
    },
    registerPrompt: () => {},
    registerResource: () => {},
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerGeneratorTools(fake as any);
  return tools;
};

const parseResult = (r: { content: { text: string }[] }): unknown =>
  JSON.parse(r.content[0].text);

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dc-mcp-")),
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

describe("[P3] dc-gen MCP 工具", () => {
  it("U1 list_batches：发现 DTO（layer/shadowed）", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tools = captureTools();
    const items = parseResult(
      await tools.get("done_coding_gen_list_batches")!({ rootDir: root }),
    ) as Array<Record<string, unknown>>;
    const widget = items.find((i) => i.name === "widget");
    expect(widget).toBeTruthy();
    expect(widget?.layer).toBe("project");
    expect(widget?.shadowed).toBe(false);
  });

  it("U2 list_questions：返回问题清单，且不污染 stdout（B5）", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tools = captureTools();
    const spy = vi.spyOn(process.stdout, "write");
    const questions = parseResult(
      await tools.get("done_coding_gen_list_questions")!({
        rootDir: root,
        type: "widget",
      }),
    ) as Array<Record<string, unknown>>;
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(questions).toEqual([{ key: "desc", required: true }]);
  });

  it("U3 add：envData 供答 → 实例落地，stdout 洁净（B5）", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tools = captureTools();
    const spy = vi.spyOn(process.stdout, "write");
    const res = parseResult(
      await tools.get("done_coding_gen_add")!({
        rootDir: root,
        type: "widget",
        name: "my-card",
        envData: { desc: "hi" },
      }),
    ) as Record<string, unknown>;
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(res.status).toBe("ok");
    const out = path.join(root, "src", "my-card", "index.ts");
    expect(fs.readFileSync(out, "utf-8")).toBe("// MyCard: hi");
  });

  it("U4 remove：往返删除实例文件", async () => {
    const root = mkTmp();
    writeBatch(root, "widget", WIDGET_CONFIG);
    const tools = captureTools();
    await tools.get("done_coding_gen_add")!({
      rootDir: root,
      type: "widget",
      name: "my-card",
      envData: { desc: "hi" },
    });
    const out = path.join(root, "src", "my-card", "index.ts");
    expect(fs.existsSync(out)).toBe(true);
    const spy = vi.spyOn(process.stdout, "write");
    await tools.get("done_coding_gen_remove")!({
      rootDir: root,
      type: "widget",
      name: "my-card",
      envData: { desc: "hi" },
    });
    expect(spy).not.toHaveBeenCalled(); // B5：remove 链 stdout 洁净
    spy.mockRestore();
    expect(fs.existsSync(out)).toBe(false);
  });

  it("U5 init：生成骨架；已存在报错；stdout 洁净（B5）", async () => {
    const root = mkTmp();
    const tools = captureTools();
    const spy = vi.spyOn(process.stdout, "write");
    const res = parseResult(
      await tools.get("done_coding_gen_init")!({ rootDir: root, type: "page" }),
    ) as Record<string, unknown>;
    expect(spy).not.toHaveBeenCalled(); // B5：init 链 stdout 洁净
    spy.mockRestore();
    expect(res.status).toBe("ok");
    expect(
      fs.existsSync(path.join(root, ".done-coding", "page", "config.json5")),
    ).toBe(true);
    await expect(
      tools.get("done_coding_gen_init")!({ rootDir: root, type: "page" }),
    ).rejects.toThrow(/已存在/);
  });

  it("U6 缺必填 → handler fail-fast（batch 不存在）", async () => {
    const root = mkTmp();
    const tools = captureTools();
    await expect(
      tools.get("done_coding_gen_add")!({
        rootDir: root,
        type: "nope",
        name: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("[P3] dc-gen MCP schema（B1 rootDir 必填）", () => {
  it("list_batches 缺 rootDir → safeParse 失败", () => {
    expect(listBatchesInputSchema.safeParse({}).success).toBe(false);
    expect(listBatchesInputSchema.safeParse({ rootDir: "/x" }).success).toBe(
      true,
    );
  });

  it("add 缺 rootDir → safeParse 失败；envData 为结构化 object（B3）", () => {
    expect(addInputSchema.safeParse({ type: "t", name: "n" }).success).toBe(
      false,
    );
    expect(
      addInputSchema.safeParse({
        rootDir: "/x",
        type: "t",
        name: "n",
        envData: { desc: "hi" },
      }).success,
    ).toBe(true);
  });

  it("init 缺 rootDir → safeParse 失败", () => {
    expect(initInputSchema.safeParse({ type: "t" }).success).toBe(false);
  });
});

describe("[P3] dc-gen 引导 prompt", () => {
  it("无 rootDir：提示必填、勿用 server cwd", () => {
    const text = buildGeneratePromptText({});
    expect(text).toContain("rootDir");
    expect(text).toContain("必填");
    expect(text).toContain("done_coding_gen_list_questions");
  });

  it("给 rootDir + type：带入文本", () => {
    const text = buildGeneratePromptText({ rootDir: "/proj", type: "widget" });
    expect(text).toContain("/proj");
    expect(text).toContain("widget");
  });
});

describe("[P3 B5/H1] applyMcpEnvConfig 中和 hijack preset", () => {
  it("继承 hijack preset 时 applyMcpEnvConfig 显式置 false → 控制台被 consoleLog:false 静默", () => {
    // 模拟继承 hijack preset（hijack 时 isAllowOutputConsole 会被强制放开）
    updateEnvConfig({
      series: "mcp",
      consoleLog: false,
      processCreateByHijack: true,
    });
    expect(processIsHijacked()).toBe(true);

    // MCP 入口的环境配置须把 hijack 显式置 false（B5）
    applyMcpEnvConfig();
    expect(processIsHijacked()).toBe(false);
    expect(isAllowOutputConsole()).toBe(false);
  });
});
