import { FormNameEnum, injectInfo } from "@/index";
import type { CreateOptions, McpCreateToolParams } from "@/types";
import type {
  McpToolRegisterItem,
  McpResourceRegisterItem,
  McpPromptRegisterItem,
} from "@done-coding/mcp-utils";
import {
  hijackChildProcess,
  outputConsole,
  params2cliParams,
} from "@done-coding/cli-utils";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getTemplateList } from "@/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
          cwd: z
            .string()
            .min(1, "创建项目的目录绝对路径不能为空")
            .describe("创建项目的目录绝对路径"),
        }),
      },
      async (input: McpCreateToolParams) => {
        outputConsole.info(`当前运行目录: ${input.cwd}`);
        // outputConsole.info(27, input);
        try {
          const createOptions: CreateOptions = {
            ...input,
            skipTemplateCompile: true,
            openGitDetailOptimize: false,
          };
          // outputConsole.info(37, process.env);
          // const res = execSync(
          //   `npx create-done-coding@${injectInfo.version} ${params2cliParams(createOptions)}`,
          //   {
          //     cwd: process.cwd(),
          //     env: process.env,
          //   },
          // );

          const cliPath = path.resolve(__dirname, "./cli.mjs");

          await hijackChildProcess({
            command: "node",
            args: [cliPath, ...params2cliParams(createOptions)],
            cwd: input.cwd,
            env: process.env,
          });
          // await createHandler(createOptions);
          outputConsole.success("项目创建成功");

          return {
            content: [
              {
                type: "text",
                text: `✅ 项目 [${input[FormNameEnum.PROJECT_NAME]}] 创建成功！`,
              },
            ],
          };
        } catch (error: any) {
          outputConsole.error("项目创建失败", error?.message || error);
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
        try {
          outputConsole.stage("获取可用项目模板列表");
          const templateList = await getTemplateList();
          outputConsole.success("获取可用项目模板列表成功");
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(templateList, null, 2),
                mimeType: "application/json",
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            contents: [
              {
                uri: uri.href,
                type: "text",
                text: `❌ 获取可用项目模板列表失败: ${error?.message || error}`,
              },
            ],
          };
        }
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
