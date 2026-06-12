import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  completeCreateProject,
  prepareCreateProject,
  readTemplateListResource,
} from "create-done-coding";
import type { McpJsonResult } from "@/types";
import {
  FormNameEnum,
  type CreateCompleteOptions,
  type CreateOptions,
} from "create-done-coding";
import { resolveHandlerContext, safeCwd } from "@done-coding/cli-utils";

/** 将任意结果包装成 MCP JSON 文本响应 */
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

/** 创建 create 工具调用使用的非交互 MCP handler 上下文 */
const createMcpContext = (rootDir?: string) => {
  return resolveHandlerContext({
    mode: "mcp",
    interactive: false,
    cwd: rootDir ?? safeCwd(),
  });
};

/**
 * prepare create MCP tool 入参 schema。
 * ---
 * `templateUrl` 为**必填**：MCP 的模板来源由「模板列表资源」(见 registerCreateResources)
 * 选定后传入，故 MCP 运行时永远带 templateUrl 进入 CLI handler，结构性地触达不到
 * 全局/远程模板列表（不联网）。导出供隔离测试断言"缺 templateUrl 被 zod 拦"。
 */
export const prepareInputSchema = z.object({
  rootDir: z.string().optional(),
  projectName: z.string(),
  templateUrl: z.string(),
  templateGitPath: z.string().optional(),
  templateGitBranch: z.string().optional(),
  templateDirectory: z.string().optional(),
  skipTemplateCompile: z.boolean().optional(),
  openGitDetailOptimize: z.boolean().optional(),
  isRemove: z.boolean().optional(),
});

/** complete create MCP tool 入参 schema */
const completeInputSchema = z.object({
  rootDir: z.string().optional(),
  draftId: z.string(),
  envData: z.record(z.string(), z.unknown()).optional(),
  gitCommitMessage: z.string().optional(),
});

/** create-mcp「模板列表资源」URI 模板。`{+configPath}` 用 RFC6570 reserved expansion
 * 保留绝对路径中的 `/`（已验证可 round-trip 真实绝对路径）。 */
export const CREATE_TEMPLATE_LIST_RESOURCE_URI_TEMPLATE =
  "done-coding-create-template-list://{+configPath}";

/** 注册 create 项目创建相关 MCP tools */
export const registerCreateTools = (server: McpServer) => {
  server.registerTool(
    "done_coding_prepare_create_project",
    {
      title: "Prepare done-coding project creation",
      description:
        "Clone a project template, inspect template preset questions, and return a draftId for completion. `templateUrl` is required in MCP mode — read the `done-coding-create-template-list://{configPath}` resource (template list) and pick a template's `url`. MCP never falls back to the home global config or the default remote template list (no network).",
      inputSchema: prepareInputSchema,
    },
    async (input) => {
      const argv: CreateOptions = {
        rootDir: input.rootDir,
        [FormNameEnum.PROJECT_NAME]: input.projectName,
        [FormNameEnum.TEMPLATE_URL]: input.templateUrl,
        [FormNameEnum.TEMPLATE_GIT_PATH]: input.templateGitPath,
        [FormNameEnum.TEMPLATE_GIT_BRANCH]: input.templateGitBranch,
        templateDirectory: input.templateDirectory,
        skipTemplateCompile: input.skipTemplateCompile,
        openGitDetailOptimize: input.openGitDetailOptimize,
        [FormNameEnum.IS_REMOVE_SAME_NAME_DIR]: input.isRemove,
      };

      const result = await prepareCreateProject(
        argv,
        createMcpContext(input.rootDir),
      );
      return toJsonResult(result);
    },
  );

  server.registerTool(
    "done_coding_complete_create_project",
    {
      title: "Complete done-coding project creation",
      description:
        "Complete a prepared project draft with template envData and git initialization options.",
      inputSchema: completeInputSchema,
    },
    async (input) => {
      const argv: CreateCompleteOptions = {
        rootDir: input.rootDir,
        draftId: input.draftId,
        envData: input.envData,
        [FormNameEnum.GIT_COMMIT_MESSAGE]: input.gitCommitMessage,
      };

      const result = await completeCreateProject(
        argv,
        createMcpContext(input.rootDir),
      );
      return toJsonResult(result);
    },
  );
};

/**
 * 注册 create「模板列表资源」。
 * ---
 * 参数化 URI：configPath 在**取资源时**传入（zod/URI 强制本地绝对路径）。
 * 回调只调 `readTemplateListResource`：仅读本地、不联网、不读家目录全局指针、不读远程默认。
 */
export const registerCreateResources = (server: McpServer) => {
  server.registerResource(
    "done-coding-create-template-list",
    new ResourceTemplate(CREATE_TEMPLATE_LIST_RESOURCE_URI_TEMPLATE, {
      list: undefined,
    }),
    {
      title: "done-coding create 模板列表",
      description:
        "从本地 configPath 指向的 { templateList: [...] } 读取可选模板，仅本地不联网。取资源时在 URI 中提供 configPath（绝对路径）。",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const configPath = Array.isArray(variables.configPath)
        ? (variables.configPath[0] ?? "")
        : String(variables.configPath ?? "");
      const payload = await readTemplateListResource(configPath);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );
};

/**
 * 注册 create 引导 Prompt：串起「读模板列表资源 → prepare → complete」全流程。
 */
export const registerCreatePrompts = (server: McpServer) => {
  server.registerPrompt(
    "create-done-coding-project",
    {
      title: "创建 done-coding 项目（引导）",
      description:
        "引导客户端完成 done-coding 项目创建：先读模板列表资源（带本地 configPath），选模板取 url 作为 templateUrl 调 prepare，再按 need_input 收集 envData 调 complete。全程不读全局/远程、不联网。",
      argsSchema: {
        configPath: z
          .string()
          .describe("本地模板列表配置文件绝对路径（取模板列表资源用）"),
        projectName: z.string().optional().describe("待创建的项目名称（可选）"),
      },
    },
    ({ configPath, projectName }) => {
      const resourceUri = `done-coding-create-template-list://${configPath}`;
      const projectNameLine = projectName
        ? `项目名称：${projectName}`
        : "项目名称：请向用户确认后填入 prepare 的 projectName";
      const text = [
        "请按以下步骤创建一个 done-coding 项目（全程仅读本地、不联网、不读全局/远程）：",
        "",
        `1. 读取模板列表资源 ${resourceUri} ，查看 templateList 中可选模板。`,
        "2. 与用户确认选定模板，取其 `url` 作为 `templateUrl`，调用工具 `done_coding_prepare_create_project`（带该 templateUrl 与 projectName）。",
        "3. 若 prepare 返回 status=need_input，按其 `questions` 收集答案，作为 `envData`（key 对齐 questions[].key）连同 `draftId` 调用 `done_coding_complete_create_project`。",
        "4. 若 prepare 返回 status=ready，直接用其 `draftId` 调用 `done_coding_complete_create_project`。",
        "",
        projectNameLine,
        `模板列表配置文件（本地）：${configPath}`,
      ].join("\n");
      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    },
  );
};
