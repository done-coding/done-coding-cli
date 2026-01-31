import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import injectInfo from "@/injectInfo.json" with { type: "json" };
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export type ZType = typeof z;

export type { McpServer };

export { injectInfo, z };

/** mcp服务 工具注册单项 */
export type McpToolRegisterItem = (
  server: Pick<McpServer, "registerTool">,
  z: ZType,
) => ReturnType<McpServer["registerTool"]>;

/** mcp服务 资源注册单项 */
export type McpResourceRegisterItem = (
  server: McpServer,
  z: ZType,
) => ReturnType<McpServer["registerResource"]>;

/** mcp服务 提示词注册单项 */
export type McpPromptRegisterItem = (
  server: Pick<McpServer, "registerPrompt">,
  z: ZType,
) => ReturnType<McpServer["registerPrompt"]>;

/** 创建MCP服务选项 */
export interface McpServerCreateOptions {
  /** 工具注册列表 */
  toolRegisterList: McpToolRegisterItem[];
  /** 资源注册列表 */
  resourceRegisterList: McpResourceRegisterItem[];
  /** 提示词注册列表 */
  promptRegisterList: McpPromptRegisterItem[];
  /** 服务名称 */
  name: string;
  /** 服务版本 */
  version: string;
}

/** 创建MCP服务 */
export const createServer = async ({
  toolRegisterList,
  resourceRegisterList,
  promptRegisterList,
  name,
  version,
}: McpServerCreateOptions) => {
  const server = new McpServer({
    name,
    version,
  });

  toolRegisterList.forEach((fn) => fn(server, z));

  resourceRegisterList.forEach((fn) => fn(server, z));

  promptRegisterList.forEach((fn) => fn(server, z));

  const transport = new StdioServerTransport();

  await server.connect(transport);

  return server;
};
