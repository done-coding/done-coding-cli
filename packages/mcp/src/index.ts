import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import injectInfo from "@/injectInfo.json" with { type: "json" };
import {
  addTool as addCreateTool,
  addResource as addCreateResource,
  addPrompt as addCreatePrompt,
} from "./create.js";

const server = new McpServer({
  name: injectInfo.name,
  version: injectInfo.version,
});

addCreateTool(server);
addCreateResource(server);
addCreatePrompt(server);

const transport = new StdioServerTransport();

await server.connect(transport);
