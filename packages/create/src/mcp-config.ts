import { FormNameEnum, injectInfo } from "@/index";
import type { CreateOptions, McpCreateAnswerPreset } from "@/types";
import type {
  McpToolRegisterItem,
  McpResourceRegisterItem,
  McpPromptRegisterItem,
} from "@done-coding/mcp-utils";
import templateConfig from "./template.json";
// import { execSync } from "node:child_process";
import { createHandler } from "@/handlers";

/** mcp服务 工具注册列表 */
export const toolRegisterList: McpToolRegisterItem[] = [
  (server, z) => {
    return server.registerTool(
      injectInfo.cliConfig.moduleName,
      {
        title: `创建项目工具 - ${injectInfo.name}`,
        description: "根据用户提供的项目名称、模板地址和分支创建新项目",
        inputSchema: z.object({
          [FormNameEnum.PROJECT_NAME]: z
            .string()
            .min(1, "项目名称不能为空")
            .describe("项目名称"),
          [FormNameEnum.TEMPLATE_GIT_PATH]: z
            .string()
            .min(1, "模板仓库地址不能为空")
            .describe("模板仓库地址"),
          [FormNameEnum.TEMPLATE_GIT_BRANCH]: z
            .string()
            .optional()
            .describe("对应的 Git 分支名称"),
        }),
      },
      async (input: McpCreateAnswerPreset) => {
        // outputConsole.info(27, input);
        try {
          const createOptions: CreateOptions = {
            ...input,
            simple: true,
          };
          // outputConsole.info(37, process.env);
          // const res = execSync(
          //   `npx create-done-coding@${injectInfo.version} ${params2cliParams(createOptions)}`,
          //   {
          //     cwd: process.cwd(),
          //     env: process.env,
          //   },
          // );
          await createHandler(createOptions);

          return {
            content: [
              {
                type: "text",
                text: `✅ 项目 [${input[FormNameEnum.PROJECT_NAME]}] 创建成功！`,
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [
              { type: "text", text: `❌ 创建失败: ${error?.message || error}` },
            ],
          };
        }
      },
    );
  },
];

/** mcp服务 资源注册列表 */
export const resourceRegisterList: McpResourceRegisterItem[] = [
  (server) => {
    return server.registerResource(
      `${injectInfo.cliConfig.moduleName}/templates`,
      `resource:///${injectInfo.cliConfig.moduleName}/templates`,
      {
        title: "可用项目模板列表",
        description: "包含所有可用的项目模板信息、仓库地址及可选分支",
      },
      async (uri: URL) => {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(templateConfig.templateList, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      },
    ) as any;
  },
];

/** mcp服务 提示词注册列表 */
export const promptRegisterList: McpPromptRegisterItem[] = [
  (server) => {
    return server.registerPrompt(
      `${injectInfo.cliConfig.moduleName}/create-project-assistant`,
      {
        title: "创建项目助手",
        description: "基于自然语言诉求创建项目",
      },
      async () => {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `你是一个专业的项目初始化助手, 根据用户的自然语言诉求，从可用项目模板列表中挑选最匹配的选项来调用${injectInfo.cliConfig.moduleName}工具创建项目`,
              },
            },
          ],
        };
      },
    );
  },
];
