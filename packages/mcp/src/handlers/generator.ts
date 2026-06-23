/**
 * dc-generator（@done-coding/cli-generator）MCP 工具接线（P3，design §1/§3/§12）。
 *
 * 单发 + 探针（Ⓔ：本地 config 单进程读→采集→落地，无 prepare/complete 两段式）。
 * codex 纳入（design §12）：
 *  - B1 rootDir 必填——[MUST NOT] fallback 到 MCP server 进程 cwd（会落错目录）。
 *  - B3 env 用结构化 object（envData），wrapper 内 JSON.stringify 传 handler。
 *  - B4 list_batches 返回含 invalid/errors，客户端须区分非法批次。
 *  - B5 stdout 洁净：list_questions/list_batches 走**返回数据**的纯函数（buildBatchQuestions /
 *    listDiscoveredBatches），[MUST NOT] 调含 process.stdout.write 的 void CLI 路径。
 *  - B2（generator 侧）：operate 交引擎前已按策略守卫必填字段（throw 而非 process.exit），
 *    故 add/remove malformed config 表现为 MCP 错误结果而非杀进程。
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addHandler,
  removeHandler,
  initHandler,
  buildBatchQuestions,
  discoverBatch,
  listDiscoveredBatches,
} from "@done-coding/cli-generator";
import type { HandlerContextInit } from "@done-coding/cli-utils";
import type { McpJsonResult } from "@/types";

/** 将任意结果包装成 MCP JSON 文本响应（复刻 create toJsonResult） */
const toJsonResult = (value: unknown): McpJsonResult => {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
};

/**
 * 构造 generator handler 的 MCP ctxInit（B1：cwd = 必填 rootDir，[MUST NOT] fallback safeCwd）。
 * 传 ctxInit（init 形态），handler 内部自行 resolveHandlerContext。
 */
const genCtxInit = (rootDir: string): HandlerContextInit => ({
  mode: "mcp",
  interactive: false,
  cwd: rootDir,
});

// ── inputSchema（B1 rootDir 必填；B3 add/remove 用结构化 envData） ──
export const listBatchesInputSchema = z.object({
  rootDir: z.string(),
});
export const listQuestionsInputSchema = z.object({
  rootDir: z.string(),
  type: z.string(),
});
export const addInputSchema = z.object({
  rootDir: z.string(),
  type: z.string(),
  name: z.string(),
  envData: z.record(z.string(), z.unknown()).optional(),
});
export const removeInputSchema = z.object({
  rootDir: z.string(),
  type: z.string(),
  name: z.string(),
  envData: z.record(z.string(), z.unknown()).optional(),
});
export const initInputSchema = z.object({
  rootDir: z.string(),
  type: z.string(),
  global: z.boolean().optional(),
});

/** 注册 dc-generator 批次生成相关 MCP tools */
export const registerGeneratorTools = (server: McpServer) => {
  server.registerTool(
    "done_coding_gen_list_batches",
    {
      title: "List discoverable dc-generator batch types",
      description:
        "Discover all reachable batch types under rootDir's `.done-coding/<type>/` (project → parent chain → global ~/.done-coding), with layer/shadowed/invalid. `rootDir` is required (the user project dir). Items with `invalid:true` carry `errors` and MUST NOT be treated as usable batches.",
      inputSchema: listBatchesInputSchema,
    },
    async (input) => {
      const items = listDiscoveredBatches("*", { cwd: input.rootDir });
      return toJsonResult(items);
    },
  );

  server.registerTool(
    "done_coding_gen_list_questions",
    {
      title: "List a dc-generator batch's questions",
      description:
        "Probe which answers a batch type needs (does not generate). Returns `[{key, required, default?}]`. `rootDir` required.",
      inputSchema: listQuestionsInputSchema,
    },
    async (input) => {
      const batch = discoverBatch(input.type, { cwd: input.rootDir });
      const questions = buildBatchQuestions(batch.config);
      return toJsonResult(questions);
    },
  );

  server.registerTool(
    "done_coding_gen_add",
    {
      title: "Add a dc-generator batch instance",
      description:
        "Generate one batch instance non-interactively. `envData` is a structured answer object (keys align with list_questions[].key). `rootDir` required.",
      inputSchema: addInputSchema,
    },
    async (input) => {
      await addHandler(
        {
          type: input.type,
          name: input.name,
          env: input.envData ? JSON.stringify(input.envData) : undefined,
        },
        genCtxInit(input.rootDir),
      );
      return toJsonResult({
        status: "ok",
        action: "add",
        type: input.type,
        name: input.name,
      });
    },
  );

  server.registerTool(
    "done_coding_gen_remove",
    {
      title: "Remove a dc-generator batch instance",
      description:
        "Reverse-recipe remove a batch instance. `envData` (optional) recomputes landed blocks for rollback. `rootDir` required.",
      inputSchema: removeInputSchema,
    },
    async (input) => {
      await removeHandler(
        {
          type: input.type,
          name: input.name,
          env: input.envData ? JSON.stringify(input.envData) : undefined,
        },
        genCtxInit(input.rootDir),
      );
      return toJsonResult({
        status: "ok",
        action: "remove",
        type: input.type,
        name: input.name,
      });
    },
  );

  server.registerTool(
    "done_coding_gen_init",
    {
      title: "Init a dc-generator batch skeleton",
      description:
        "Scaffold a batch skeleton (index.json + config.json5 + template/). Errors if the target exists. With `global:true` writes to ~/.done-coding; otherwise under rootDir/.done-coding. `rootDir` required.",
      inputSchema: initInputSchema,
    },
    async (input) => {
      await initHandler(
        { type: input.type, global: input.global },
        genCtxInit(input.rootDir),
      );
      return toJsonResult({
        status: "ok",
        action: "init",
        type: input.type,
        global: Boolean(input.global),
      });
    },
  );
};

/**
 * 生成 dc-generator 引导 prompt 文本（纯函数，供注册回调与单测复用）。
 * 两步心智：先 list_questions 拿问题清单，再 add 带答案落地。
 */
export const buildGeneratePromptText = (params: {
  rootDir?: string;
  type?: string;
}): string => {
  const { rootDir, type } = params;
  const rootDirLine = rootDir
    ? `项目根目录 rootDir：${rootDir}`
    : "项目根目录 rootDir：请向用户确认其项目绝对路径（MCP 工具 rootDir [MUST] 必填，勿用 server 进程 cwd）";
  const typeLine = type
    ? `批次类型 type：${type}`
    : "批次类型 type：可先调 done_coding_gen_list_batches 看可用批次（跳过 invalid:true 的非法批次）";

  return [
    "请按以下步骤用 done-coding dc-generator 生成一个批次实例（全程本地、非交互）：",
    "",
    `1. 确认 ${rootDirLine}`,
    `2. ${typeLine}`,
    "3. 调 done_coding_gen_list_questions（传 rootDir + type）拿到该批次问题清单 [{key,required,default?}]。",
    "4. 与用户确认 required:true 的答案，拼成 envData 对象（key 对齐 questions[].key，非 label）。",
    "5. 调 done_coding_gen_add（传 rootDir + type + name + envData）落地实例。",
    "   - 移除实例用 done_coding_gen_remove；新建批次骨架用 done_coding_gen_init。",
  ].join("\n");
};

/** 注册 dc-generator 引导 Prompt：串起「确认 rootDir/type → list_questions → add」。 */
export const registerGeneratorPrompts = (server: McpServer) => {
  server.registerPrompt(
    "done-coding-generate",
    {
      title: "生成 done-coding 批次实例（引导）",
      description:
        "引导客户端用 dc-generator 生成批次实例：确认项目 rootDir 与批次 type（先 list_batches 看可用、跳过 invalid），再 list_questions → add。rootDir [MUST] 必填、勿用 MCP server 进程 cwd。",
      argsSchema: {
        rootDir: z
          .string()
          .optional()
          .describe(
            "用户项目根目录绝对路径（dc-generator 工具的 rootDir，必填项）",
          ),
        type: z
          .string()
          .optional()
          .describe("批次类型（可选，不给则先 list_batches）"),
      },
    },
    ({ rootDir, type }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: buildGeneratePromptText({ rootDir, type }),
            },
          },
        ],
      };
    },
  );
};
