import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  prepareInputSchema,
  CREATE_TEMPLATE_LIST_RESOURCE_URI_TEMPLATE,
  buildCreateProjectPromptText,
  LOCAL_POINTER_CONFIG_DISPLAY_PATH,
} from "@/handlers";

/**
 * create-mcp 注册层隔离测试
 * ---
 * 1. prepare 工具 zod schema：`templateUrl` 必填——缺失被 zod 拦（结构性隔离的根）。
 * 2. 模板列表资源 URI `{+configPath}`：真实绝对路径可 round-trip（design §1 风险项落地验证）。
 *
 * 直测 src（vitest alias `@`→src）。`@/handlers` 经 create.ts 间接 import 构建产物
 * `create-done-coding` 与 `@done-coding/cli-utils`，故 beforeAll 确保依赖已构建。
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(TEST_DIR, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "..", "..");
const CREATE_ES = path.resolve(
  REPO_ROOT,
  "packages",
  "create",
  "es",
  "index.mjs",
);

beforeAll(() => {
  if (process.env.DC_SKIP_BUILD !== "1" && !existsSync(CREATE_ES)) {
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
      throw new Error(`构建依赖包失败：\n${build.stdout}\n${build.stderr}`);
    }
  }
}, 120000);

describe("prepare 工具 zod schema：templateUrl 必填", () => {
  it("缺 templateUrl：safeParse 失败（不进入任何模板来源解析）", () => {
    const parsed = prepareInputSchema.safeParse({ projectName: "demo" });
    expect(parsed.success).toBe(false);
  });

  it("带 templateUrl：safeParse 成功", () => {
    const parsed = prepareInputSchema.safeParse({
      projectName: "demo",
      templateUrl: "/abs/path/to/template-repo",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("create 引导 prompt 文本：模板来源三情形", () => {
  it("已给 configPath：引导读模板列表资源、不提指针/反问", () => {
    const cfg = "/Users/me/proj/create-templates.json";
    const text = buildCreateProjectPromptText({
      configPath: cfg,
      projectName: "demo",
    });
    expect(text).toContain(`done-coding-create-template-list://${cfg}`);
    expect(text).toContain("项目名称：demo");
    expect(text).not.toContain(LOCAL_POINTER_CONFIG_DISPLAY_PATH);
    expect(text).not.toContain("反问用户");
  });

  it("未给 configPath：引导先查全局指针、无配置则反问用户 repo+目录", () => {
    const text = buildCreateProjectPromptText({});
    expect(text).toContain(LOCAL_POINTER_CONFIG_DISPLAY_PATH);
    expect(text).toContain("哪个仓库");
    expect(text).toContain("templateDirectory");
    // 未给项目名 → 占位提示
    expect(text).toContain("请向用户确认后填入 prepare 的 projectName");
  });

  it("两情形都串到 prepare→complete 两个工具", () => {
    for (const text of [
      buildCreateProjectPromptText({ configPath: "/abs/x.json" }),
      buildCreateProjectPromptText({}),
    ]) {
      expect(text).toContain("done_coding_prepare_create_project");
      expect(text).toContain("done_coding_complete_create_project");
    }
  });
});

describe("模板列表资源 URI：{+configPath} 绝对路径 round-trip", () => {
  it("真实绝对路径可 expand 后 match 还原", () => {
    const abs = "/Users/me/proj/.done-coding/create/index.json";
    const rt = new ResourceTemplate(
      CREATE_TEMPLATE_LIST_RESOURCE_URI_TEMPLATE,
      { list: undefined },
    );
    const ut = rt.uriTemplate;
    const expanded = ut.expand({ configPath: abs });
    const matched = ut.match(expanded);
    expect(matched).not.toBeNull();
    expect(matched?.configPath).toBe(abs);
  });
});
