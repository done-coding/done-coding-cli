import { FormNameEnum, createHandler, injectInfo } from "create-done-coding";
import type { McpCreateAnswerPreset } from "create-done-coding";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import templateConfig from "./template.json" with { type: "json" };

/** 添加工具：执行创建项目的动作 */
export const addTool = (server: McpServer) => {
  return server.registerTool(
    injectInfo.cliConfig.moduleName,
    {
      title: `创建项目工具 - ${injectInfo.name}`,
      description: "根据用户提供的项目名称、模板地址和分支创建新项目",
      inputSchema: z.object({
        [FormNameEnum.PROJECT_NAME]: z.string().min(1, "项目名称不能为空"),
        [FormNameEnum.TEMPLATE_GIT_PATH]: z
          .string()
          .min(1, "模板仓库地址不能为空"),
        [FormNameEnum.TEMPLATE_GIT_BRANCH]: z
          .string()
          .optional()
          .describe("对应的 Git 分支名称"),
      }),
    },
    async (input: McpCreateAnswerPreset) => {
      try {
        await createHandler({
          _mcp: input,
        });
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
          content: [
            { type: "text", text: `❌ 创建失败: ${error?.message || error}` },
          ],
        };
      }
    },
  );
};

/** 添加资源：让 AI 能够查阅当前支持的所有模板列表 */
/** 添加资源 */
export const addResource = (server: McpServer) => {
  return server.registerResource(
    "template-list", // 1. name: 唯一标识符
    `resource:///${injectInfo.cliConfig.moduleName}/templates`, // 2. uriOrTemplate: 资源访问的 URI
    {
      title: "可用项目模板列表", // 3. config: 属性名是 title 而不是 name
      description: "包含所有可用的项目模板信息、仓库地址及可选分支",
    },
    async (uri) => {
      // 4. readCallback: 读取回调
      return {
        contents: [
          // 注意：新版 SDK 通常使用 contents (复数)
          {
            uri: uri.href,
            text: JSON.stringify(templateConfig.templateList, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );
};

/** 添加提示词：引导 AI 如何与用户沟通并收集参数 */
/** 添加提示词 */
export const addPrompt = (server: McpServer) => {
  return server.registerPrompt(
    `${injectInfo.cliConfig.moduleName}/create-project-assistant`,
    {
      title: "创建项目助手", // 将 name 修改为 title
      description: "引导用户从模板列表中选择并初始化项目",
    },
    async () => {
      return {
        messages: [
          {
            role: "user", // 注意：部分版本 SDK 只有 user 和 assistant 角色，system 有时需写在外面
            content: {
              type: "text",
              text: `你是一个专业的项目初始化助手... (此处省略之前的 prompt 内容)`,
            },
          },
        ],
      };
    },
  );
};
