import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { updateEnvConfig } from "@done-coding/cli-utils";
import {
  registerCreateTools,
  registerCreateResources,
  registerCreatePrompts,
} from "@/handlers";
import injectInfo from "@/injectInfo.json";

/** 创建并启动 done-coding MCP stdio server */
export const createMcpServer = async () => {
  updateEnvConfig({
    series: "mcp",
    consoleLog: false,
  });

  const server = new McpServer({
    name: injectInfo.name,
    version: injectInfo.version,
  });

  registerCreateTools(server);
  registerCreateResources(server);
  registerCreatePrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
};
