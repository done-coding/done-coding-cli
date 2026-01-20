import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import injectInfo from "@/injectInfo.json" with { type: "json" };
import type {
  McpToolRegisterOptions,
  McpResourceRegisterOptions,
  McpPromptRegisterOptions,
} from "./types.js";
import { z } from "zod";

/** 注册服务 */
export const registerServer = async ({
  toolConfigList,
  resourceConfigList,
  promptConfigList,
}: {
  toolConfigList: McpToolRegisterOptions<object>[];
  resourceConfigList: McpResourceRegisterOptions[];
  promptConfigList: McpPromptRegisterOptions[];
}) => {
  const server = new McpServer({
    name: injectInfo.name,
    version: injectInfo.version,
  });

  toolConfigList.forEach(
    ({ name, title, description, getInputSchema, handler }) =>
      server.registerTool(
        name,
        {
          title,
          description,
          inputSchema: getInputSchema(z),
        },
        // @ts-ignore
        async (...args: Parameters<typeof handler>) => {
          try {
            // @ts-ignore
            return await handler(...args);
          } catch (error: any) {
            return {
              content: [
                {
                  type: "text",
                  text: `❌ 工具${name}创建失败: ${error?.message || error}`,
                },
              ],
            };
          }
        },
      ),
  );

  // @ts-ignore
  resourceConfigList.forEach(({ name, url, title, description, handler }) =>
    server.registerResource(
      name,
      url,
      {
        title,
        description,
      },
      async (...args: Parameters<typeof handler>) => {
        // 4. readCallback: 读取回调
        // return {
        //   contents: [
        //     // 注意：新版 SDK 通常使用 contents (复数)
        //     {
        //       uri: uri.href,
        //       text: JSON.stringify(templateConfig.templateList, null, 2),
        //       mimeType: "application/json",
        //     },
        //   ],
        // };

        try {
          return await handler(...args);
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 资源${name}创建失败: ${error?.message || error}`,
              },
            ],
          };
        }
      },
    ),
  );

  promptConfigList.forEach(({ name, title, description, handler }) =>
    server.registerPrompt(
      name,
      {
        title,
        description,
      },
      // @ts-ignore
      async (...args: Parameters<typeof handler>) => {
        // return {
        //   messages: [
        //     {
        //       role: "user", // 注意：部分版本 SDK 只有 user 和 assistant 角色，system 有时需写在外面
        //       content: {
        //         type: "text",
        //         text: `你是一个专业的项目初始化助手... (此处省略之前的 prompt 内容)`,
        //       },
        //     },
        //   ],
        // };

        try {
          return await handler(...args);
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `❌ 提示词${name}创建失败: ${error?.message || error}`,
              },
            ],
          };
        }
      },
    ),
  );

  const transport = new StdioServerTransport();

  await server.connect(transport);

  return server;
};
