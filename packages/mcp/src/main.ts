import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { updateEnvConfig } from "@done-coding/cli-utils";
import {
  registerCreateTools,
  registerCreateResources,
  registerCreatePrompts,
  registerGeneratorTools,
  registerGeneratorPrompts,
} from "@/handlers";
import injectInfo from "@/injectInfo.json";

/**
 * 应用 MCP stdio 进程的环境配置（P3 B5，可测）。
 * consoleLog:false 静默控制台 + **显式 processCreateByHijack:false**——否则继承 hijack preset 会让
 * isAllowOutputConsoleType 无视 consoleLog:false 强制输出、污染 stdio JSON-RPC。
 */
export const applyMcpEnvConfig = () => {
  updateEnvConfig({
    series: "mcp",
    consoleLog: false,
    processCreateByHijack: false,
  });
};

/** 创建并启动 done-coding MCP stdio server */
export const createMcpServer = async () => {
  applyMcpEnvConfig();

  const server = new McpServer({
    name: injectInfo.name,
    version: injectInfo.version,
  });

  registerCreateTools(server);
  registerCreateResources(server);
  registerCreatePrompts(server);

  // P3：dc-gen（cli-generator）工具 + 引导 prompt 并列注册（同中央 server，Ⓑ）
  registerGeneratorTools(server);
  registerGeneratorPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
};
