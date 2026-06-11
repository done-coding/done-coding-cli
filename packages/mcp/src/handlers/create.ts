import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  completeCreateProject,
  prepareCreateProject,
  readTemplateListFromFile,
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

/** prepare create MCP tool 入参 schema */
const prepareInputSchema = z.object({
  rootDir: z.string().optional(),
  projectName: z.string(),
  templateUrl: z.string().optional(),
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

/** 注册 create 项目创建相关 MCP tools */
export const registerCreateTools = (server: McpServer) => {
  server.registerTool(
    "done_coding_list_create_templates",
    {
      title: "List done-coding create templates from a local config file",
      description:
        "Return the project template list read from the LOCAL config file at `configPath` (a JSON file shaped `{ templateList: [...] }`). Required. No network access. Pick a template and pass its url as `templateUrl` to the prepare tool. Returns an empty list if the file is missing or invalid.",
      inputSchema: z.object({
        configPath: z
          .string()
          .describe("本地模板列表配置文件的绝对路径（必填，不联网）"),
      }),
    },
    async (input) => {
      const templateList = await readTemplateListFromFile(input.configPath);
      return toJsonResult({
        source: "local",
        configPath: input.configPath,
        templateList,
      });
    },
  );

  server.registerTool(
    "done_coding_prepare_create_project",
    {
      title: "Prepare done-coding project creation",
      description:
        "Clone a project template, inspect template preset questions, and return a draftId for completion.",
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
