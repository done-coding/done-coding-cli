/* eslint-disable no-template-curly-in-string -- 字面 `${}` 是 generator 模板语法，非 JS 模板串 */
/**
 * [T7] 模块模板 MCP 工具接线测试（codegen-unified design §五）。
 *
 * - fake server 捕获 registerTool 的 handler 直接调用（不起真 stdio server）。
 * - 模拟 MCP：updateEnvConfig({consoleLog:false}) + fake HOME 隔离全局层（防真实 ~/.done-coding 污染）。
 * - B5 stdout 洁净：list_* 纯函数零 stdout；tree_* 以 json:false 走返回值（emitJson 裸写 stdout 不受
 *   consoleLog 门控，会污染 stdio MCP 流——修复后零 stdout）。
 * - 全沙盒：夹具落 tmp，afterEach 清理。
 * - 描述动态生成证据：改 schema.json → 再调用 → whenToUse/params 跟随变化。
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { updateEnvConfig } from "@done-coding/cli-utils";
import {
  discoverTemplates,
  readTemplateSchema,
  treeHandler,
} from "@done-coding/cli-generator";
import {
  registerModuleTemplateTools,
  listModuleTemplatesInputSchema,
  listParamsInputSchema,
  treeBuildInputSchema,
} from "@/handlers";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..", "..");
const GENERATOR_ES = path.resolve(
  REPO_ROOT,
  "packages",
  "generator",
  "es",
  "index.mjs",
);

const realHome = process.env.HOME;
let fakeHome = "";
beforeAll(() => {
  if (
    process.env.DC_SKIP_BUILD !== "1" &&
    (!fs.existsSync(GENERATOR_ES) ||
      !fs.readFileSync(GENERATOR_ES, "utf-8").includes("treeHandler"))
  ) {
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
  // fake HOME 隔离全局层：discoverTemplates / resolveDoneCodingDir 的 os.homedir() 读 $HOME
  fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "dc-mcp-home-"));
  process.env.HOME = fakeHome;
}, 120000);
afterAll(() => {
  process.env.HOME = realHome;
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

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
  registerModuleTemplateTools(fake as any);
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

/** 写一个模块模板夹具（schema + 可选 fragments）。 */
const writeTemplate = (opts: {
  root: string;
  base: string;
  template: string;
  schema: Record<string, unknown>;
  fragments?: Record<string, string>;
}): string => {
  const { root, base, template, schema, fragments } = opts;
  const tplDir = path.join(root, ".done-coding", "templates", base, template);
  fs.mkdirSync(path.join(tplDir, "fragments"), { recursive: true });
  fs.writeFileSync(
    path.join(tplDir, "schema.json"),
    JSON.stringify(schema, null, 2),
    "utf-8",
  );
  if (fragments) {
    for (const [rel, content] of Object.entries(fragments)) {
      fs.writeFileSync(path.join(tplDir, "fragments", rel), content, "utf-8");
    }
  }
  return tplDir;
};

/** 临时 git 仓（tree 工具 gitRoot 锚定必需）。 */
const mkGitRepo = (): string => {
  const repo = mkTmp();
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
  return repo;
};

/** os.tmpdir 下残留的 dc-tree-* 临时 recipe（应始终为空，finally 清理） */
const leftoverTreeTemp = (): string[] =>
  fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("dc-tree-"));

/** 标准模块 Recipe（addFragment + writeFile，无 textPatch） */
const moduleRecipe = (id = "demo-module"): Record<string, unknown> => ({
  id,
  base: { kind: "empty" },
  output: "src/modules/demo",
  render: true,
  vars: { title: "Demo" },
  ops: [
    {
      type: "addFragment",
      id: "page",
      source: "admin-core/list-page/fragments/Index.vue.vm",
      target: "Index.vue",
    },
    {
      type: "writeFile",
      id: "readme",
      target: "README.md",
      content: "# demo-module\n",
    },
  ],
});

describe("[T7] 模块模板 MCP 工具", () => {
  it("list_module_templates：资产即列表，返回 name/base/layer/dir/whenToUse（来自 schema）", async () => {
    const root = mkTmp();
    writeTemplate({
      root,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "标准列表页",
        params: {
          type: "object",
          properties: { title: { type: "string" } },
        },
      },
    });
    writeTemplate({
      root,
      base: "admin-core",
      template: "table-page",
      schema: {
        whenToUse: "表格页",
        params: {
          type: "object",
          properties: {},
        },
      },
    });
    const tools = captureTools();
    const items = parseResult(
      await tools.get("done_coding_gen_list_module_templates")!({
        rootDir: root,
        base: "admin-core",
      }),
    ) as Array<Record<string, unknown>>;
    expect(items.map((i) => i.name).sort()).toEqual([
      "list-page",
      "table-page",
    ]);
    const listPage = items.find((i) => i.name === "list-page");
    expect(listPage?.base).toBe("admin-core");
    expect(listPage?.layer).toBe("project");
    expect(listPage?.whenToUse).toBe("标准列表页");
    expect(String(listPage?.dir)).toContain("list-page");
  });

  it("描述动态生成：改 schema.json → 再调用 → whenToUse / params 跟随（单一事实源，ⓑ）", async () => {
    const root = mkTmp();
    writeTemplate({
      root,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "标准列表页 v1",
        params: {
          type: "object",
          properties: { title: { type: "string" } },
        },
      },
    });
    const tools = captureTools();
    const listTool = tools.get("done_coding_gen_list_module_templates")!;
    const paramsTool = tools.get("done_coding_gen_list_params")!;

    const before = parseResult(
      await listTool({ rootDir: root, base: "admin-core" }),
    ) as Array<Record<string, unknown>>;
    expect(before[0].whenToUse).toBe("标准列表页 v1");

    // 改模板 schema → 再调用，无需重启/重注册，返回自动跟随
    writeTemplate({
      root,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "详情页范式 v2",
        params: {
          type: "object",
          properties: {
            title: { type: "string" },
            columns: { type: "array", items: { type: "string" } },
          },
          required: ["title"],
        },
      },
    });
    const after = parseResult(
      await listTool({ rootDir: root, base: "admin-core" }),
    ) as Array<Record<string, unknown>>;
    expect(after[0].whenToUse).toBe("详情页范式 v2");

    const params = parseResult(
      await paramsTool({
        rootDir: root,
        base: "admin-core",
        template: "list-page",
      }),
    ) as Record<string, unknown>;
    expect(params.whenToUse).toBe("详情页范式 v2");
    expect(params.params).toEqual({
      type: "object",
      properties: {
        title: { type: "string" },
        columns: { type: "array", items: { type: "string" } },
      },
      required: ["title"],
    });
  });

  it("list_params：返回 params + defaults；base / template 未找到 → fail-loud 报错", async () => {
    const root = mkTmp();
    writeTemplate({
      root,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "标准列表页",
        params: {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
        defaults: { title: "Demo" },
      },
    });
    const tools = captureTools();
    const res = parseResult(
      await tools.get("done_coding_gen_list_params")!({
        rootDir: root,
        base: "admin-core",
        template: "list-page",
      }),
    ) as Record<string, unknown>;
    expect(res.name).toBe("list-page");
    expect(res.base).toBe("admin-core");
    expect(res.layer).toBe("project");
    expect(res.whenToUse).toBe("标准列表页");
    expect(res.params).toEqual({
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    });
    expect(res.defaults).toEqual({ title: "Demo" });

    // template 未找到 → throw
    await expect(
      tools.get("done_coding_gen_list_params")!({
        rootDir: root,
        base: "admin-core",
        template: "nope",
      }),
    ).rejects.toThrow(/未找到/);
    // base 未找到 → throw（无任何模板）
    await expect(
      tools.get("done_coding_gen_list_params")!({
        rootDir: root,
        base: "no-such-base",
        template: "list-page",
      }),
    ).rejects.toThrow(/未发现任何模块模板/);
  });

  it("list_* 纯函数：调用期间零 stdout（B5）", async () => {
    const root = mkTmp();
    writeTemplate({
      root,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "标准列表页",
        params: { type: "object", properties: {} },
      },
    });
    const tools = captureTools();
    const spy = vi.spyOn(process.stdout, "write");
    await tools.get("done_coding_gen_list_module_templates")!({
      rootDir: root,
      base: "admin-core",
    });
    await tools.get("done_coding_gen_list_params")!({
      rootDir: root,
      base: "admin-core",
      template: "list-page",
    });
    expect(spy).not.toHaveBeenCalled(); // B5：list 链 stdout 洁净
    spy.mockRestore();
  });

  it("tree_build：git 仓内落盘产物 + manifest + payload 返回 + 临时 recipe finally 清理", async () => {
    const repo = mkGitRepo();
    writeTemplate({
      root: repo,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "标准列表页",
        params: { type: "object", properties: { title: { type: "string" } } },
      },
      fragments: { "Index.vue.vm": "<template><h1>${title}</h1></template>\n" },
    });
    const tools = captureTools();
    const spy = vi.spyOn(process.stdout, "write");
    const res = parseResult(
      await tools.get("done_coding_gen_tree_build")!({
        rootDir: repo,
        recipe: moduleRecipe(),
      }),
    ) as Array<Record<string, unknown>>;
    expect(spy).not.toHaveBeenCalled(); // B5：tree_build stdout 洁净（json:false 走返回值，不触发 emitJson 裸写）
    spy.mockRestore();
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].recipeId).toBe("demo-module");
    expect(String(res[0].output)).toContain("src/modules/demo");

    const outDir = path.join(repo, "src", "modules", "demo");
    expect(fs.readFileSync(path.join(outDir, "Index.vue"), "utf-8")).toBe(
      "<template><h1>Demo</h1></template>\n",
    );
    expect(fs.readFileSync(path.join(outDir, "README.md"), "utf-8")).toBe(
      "# demo-module\n",
    );
    expect(
      fs.existsSync(
        path.join(
          repo,
          ".done-coding",
          "generator",
          "assemble",
          "manifests",
          "demo-module.json",
        ),
      ),
    ).toBe(true);
    // 临时 recipe 已清理（finally）
    expect(leftoverTreeTemp()).toEqual([]);
  });

  it("tree_check：改产物 → drifted:true（项目内漂移闸）", async () => {
    const repo = mkGitRepo();
    writeTemplate({
      root: repo,
      base: "admin-core",
      template: "list-page",
      schema: {
        whenToUse: "标准列表页",
        params: { type: "object", properties: { title: { type: "string" } } },
      },
      fragments: { "Index.vue.vm": "<template><h1>${title}</h1></template>\n" },
    });
    const tools = captureTools();
    const recipe = moduleRecipe();
    const buildSpy = vi.spyOn(process.stdout, "write");
    await tools.get("done_coding_gen_tree_build")!({ rootDir: repo, recipe });
    expect(buildSpy).not.toHaveBeenCalled(); // B5：tree_build stdout 洁净
    buildSpy.mockRestore();

    // 手改产物 → check 报漂移
    fs.writeFileSync(
      path.join(repo, "src", "modules", "demo", "Index.vue"),
      "tampered",
      "utf-8",
    );
    const spy = vi.spyOn(process.stdout, "write");
    const drift = parseResult(
      await tools.get("done_coding_gen_tree_check")!({ rootDir: repo, recipe }),
    ) as Array<Record<string, unknown>>;
    expect(spy).not.toHaveBeenCalled(); // B5：tree_check stdout 洁净
    spy.mockRestore();
    expect(drift[0].drifted).toBe(true);
    expect(leftoverTreeTemp()).toEqual([]);

    // 还原 → check 无漂移
    fs.writeFileSync(
      path.join(repo, "src", "modules", "demo", "Index.vue"),
      "<template><h1>Demo</h1></template>\n",
      "utf-8",
    );
    const ok = parseResult(
      await tools.get("done_coding_gen_tree_check")!({ rootDir: repo, recipe }),
    ) as Array<Record<string, unknown>>;
    expect(ok[0].drifted).toBe(false);
  });

  it("generator 公共出口：treeHandler / discoverTemplates / readTemplateSchema 已导出（ⓓⓔ）", () => {
    expect(typeof treeHandler).toBe("function");
    expect(typeof discoverTemplates).toBe("function");
    expect(typeof readTemplateSchema).toBe("function");
  });
});

describe("[T7] 模块模板 MCP schema（rootDir 必填 + recipe 宽松）", () => {
  it("list_module_templates 缺 rootDir → safeParse 失败", () => {
    expect(
      listModuleTemplatesInputSchema.safeParse({ base: "admin-core" }).success,
    ).toBe(false);
    expect(
      listModuleTemplatesInputSchema.safeParse({
        rootDir: "/x",
        base: "admin-core",
      }).success,
    ).toBe(true);
  });

  it("list_params 缺 template → safeParse 失败", () => {
    expect(
      listParamsInputSchema.safeParse({ rootDir: "/x", base: "admin-core" })
        .success,
    ).toBe(false);
  });

  it("tree_build recipe：合法模块 Recipe 通过；缺 id/base/output/ops → 失败；op 多余字段 passthrough", () => {
    const ok = treeBuildInputSchema.safeParse({
      rootDir: "/repo",
      recipe: moduleRecipe(),
    });
    expect(ok.success).toBe(true);
    expect(
      treeBuildInputSchema.safeParse({ rootDir: "/repo", recipe: { id: "x" } })
        .success,
    ).toBe(false);
    // op 携带 content/source 等 passthrough 字段可过（宽松，适配 AI 填 spec）
    const withExtras = moduleRecipe();
    withExtras.ops[0] = {
      type: "addFragment",
      id: "page",
      target: "Index.vue",
      source: "admin-core/list-page/fragments/Index.vue.vm",
      render: true,
    };
    expect(
      treeBuildInputSchema.safeParse({ rootDir: "/repo", recipe: withExtras })
        .success,
    ).toBe(true);
  });
});
