/**
 * dc-generator 模块模板 MCP 工具接线（codegen-unified T7，design §五）。
 *
 * 与项目级 create 工具 [MUST NOT] 混淆：create 的模板列表是 RESOURCE
 * `done-coding-create-template-list`（项目级模板）；本组工具是**模块模板**
 * （`.done-coding/templates/<base>/`，模块生成专用）。
 *
 *  - list_module_templates / list_params：纯函数调用（B5，无 stdout）——资产即列表，各模板
 *    schema.json 为**单一事实源**（when-to-use / 参数类型 / 预制默认值），每次调用实时读盘；
 *    模板改则返回自动跟随（ⓑ"描述动态生成"防双维护），静态工具 description [MUST NOT] 焊死模板信息。
 *  - tree_build / tree_check：把模块 Recipe 落 os.tmpdir 临时 json5（finally 清理）→
 *    treeHandler（gitRoot 锚定委托 assemble 引擎，server-agnostic 复用，[MUST NOT] 重实现）。
 *    Recipe 用 zod 建模、宽松（AI 填 spec 的 passthrough），见 recipeSchema。
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverTemplates,
  readTemplateSchema,
  treeHandler,
} from "@done-coding/cli-generator";
import type { HandlerContextInit } from "@done-coding/cli-utils";
import type { McpJsonResult } from "@/types";
import { toJsonResult } from "./generator";

// ── tree 模块配方 zod（ⓒ 宽松建模，适配 AI 填 spec：op 层 passthrough 放行内容/来源等） ──
const recipeOpSchema = z
  .object({
    type: z.string(),
    id: z.string(),
    target: z.string(),
  })
  .passthrough();

const recipeSchema = z.object({
  id: z.string(),
  base: z.union([
    z.object({ kind: z.literal("empty") }),
    z.object({
      kind: z.literal("dir"),
      from: z.string(),
      exclude: z.array(z.string()).optional(),
    }),
  ]),
  output: z.string(),
  vars: z.record(z.string(), z.unknown()).optional(),
  render: z.boolean().optional(),
  // post-render 格式化钩子（opt-in）：用目标项目自己的 prettier 在落盘前格式化产物
  format: z.enum(["prettier"]).optional(),
  ops: z.array(recipeOpSchema),
  createTemplate: z
    .object({
      configPath: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })
    .optional(),
});

// ── inputSchema（rootDir 必填，B1：cwd = 项目根，[MUST NOT] fallback server cwd） ──
export const listModuleTemplatesInputSchema = z.object({
  rootDir: z.string(),
  base: z.string(),
});
export const listParamsInputSchema = z.object({
  rootDir: z.string(),
  base: z.string(),
  template: z.string(),
});
export const treeBuildInputSchema = z.object({
  rootDir: z.string(),
  recipe: recipeSchema,
});
export const treeCheckInputSchema = z.object({
  rootDir: z.string(),
  recipe: recipeSchema,
});

/** tree handler 的 MCP ctxInit（mode=mcp 非交互；cwd = 必填 rootDir）。 */
const treeCtxInit = (rootDir: string): HandlerContextInit => ({
  mode: "mcp",
  interactive: false,
  cwd: rootDir,
});

/** 临时 recipe 落盘 → treeHandler → 返回 payload；临时文件 [MUST] finally 清理（ⓒ）。 */
const runTree = async (
  rootDir: string,
  recipe: unknown,
  action: "build" | "check",
): Promise<McpJsonResult> => {
  const tempFile = path.join(
    os.tmpdir(),
    `dc-tree-${action}-${Date.now()}-${Math.random().toString(36).slice(2)}.json5`,
  );
  try {
    // 模块 Recipe 以 JSON 写入（JSON ⊂ JSON5，loadRecipe 经 json5.parse 原样读入）
    fs.writeFileSync(tempFile, JSON.stringify(recipe, null, 2), "utf-8");
    // json:false——emitJson 直写 stdout 不受 consoleLog:false 门控，会污染 MCP stdio JSON-RPC 流；
    // 无论 json 与否 handleBuild/handleCheck 都返回同一 payload，走输出则被 consoleLog:false 门控（零 stdout）
    const result = await treeHandler(
      { action, recipe: tempFile, json: false },
      treeCtxInit(rootDir),
    );
    return toJsonResult(result.payload);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
};

/** 注册模块模板 MCP tools（design §五；与项目级 create 工具分开暴露）。 */
export const registerModuleTemplateTools = (server: McpServer) => {
  server.registerTool(
    "done_coding_gen_list_module_templates",
    {
      title: "List discoverable module templates",
      description:
        "扫项目就近 `.done-coding/templates/<base>/` 的模块模板（资产即列表，按名去重、就近优先）。权威 when-to-use 与参数类型来自各模板 schema.json——先调本工具 / list_params 读取当前 schema，勿假设固定模板。`rootDir`（项目 git 根）与 `base`（基座名，如 admin-core）必填。",
      inputSchema: listModuleTemplatesInputSchema,
    },
    async (input) => {
      const templates = discoverTemplates(input.base, input.rootDir);
      return toJsonResult(
        templates.map((t) => ({
          name: t.name,
          base: t.base,
          layer: t.layer,
          dir: t.dir,
          whenToUse: t.schema.whenToUse,
        })),
      );
    },
  );

  server.registerTool(
    "done_coding_gen_list_params",
    {
      title: "Read a module template's params (schema)",
      description:
        "读单个模块模板的 schema.json：参数类型（params，JSON Schema 对象）与预制默认值（defaults）+ 选型提示（whenToUse）。权威来源 = 模板 schema.json，模板改则返回自动跟随。base 或 template 不存在 → 报错。`rootDir` 必填。",
      inputSchema: listParamsInputSchema,
    },
    async (input) => {
      const templates = discoverTemplates(input.base, input.rootDir);
      if (templates.length === 0) {
        throw new Error(
          `base「${input.base}」下未发现任何模块模板（可先调 done_coding_gen_list_module_templates 确认可用 base）`,
        );
      }
      const template = templates.find((t) => t.name === input.template);
      if (!template) {
        throw new Error(
          `模块模板「${input.template}」在 base「${input.base}」下未找到（可先调 done_coding_gen_list_module_templates 确认可用模板）`,
        );
      }
      const schema = readTemplateSchema(template.dir);
      return toJsonResult({
        name: template.name,
        base: template.base,
        layer: template.layer,
        dir: template.dir,
        whenToUse: schema.whenToUse,
        params: schema.params,
        defaults: schema.defaults,
      });
    },
  );

  server.registerTool(
    "done_coding_gen_tree_build",
    {
      title: "Build module(s) from a module recipe",
      description:
        "按模块 Recipe（assemble Recipe：id/base/output/vars/ops，ops type ∈ addFragment/writeFile/textPatch）在 rootDir 的 git 仓内生成页面 + 注入现有项目（gitRoot 锚定）。配方模板与参数类型来自各模板 schema.json——先调 list_module_templates / list_params 读取，勿假设固定模板。`rootDir`（项目 git 根）必填；非 git 仓 fail-loud。",
      inputSchema: treeBuildInputSchema,
    },
    async (input) => runTree(input.rootDir, input.recipe, "build"),
  );

  server.registerTool(
    "done_coding_gen_tree_check",
    {
      title: "Check a module recipe for drift",
      description:
        "项目内漂移闸：按模块 Recipe 比对已生成产物与 manifest（页面产物），有漂移返回 drifted:true。`rootDir`（项目 git 根）必填；配方模板与参数类型来自各模板 schema.json——先调 list_module_templates / list_params 读取，勿假设固定模板。",
      inputSchema: treeCheckInputSchema,
    },
    async (input) => runTree(input.rootDir, input.recipe, "check"),
  );
};
