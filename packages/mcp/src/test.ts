/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-30 21:15:09
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-31 16:38:48
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { injectInfo } from "create-done-coding";
// import injectInfo from '@/injectInfo.json' with { type: 'json' }
import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, "./index.mjs");

async function callMyMcpService() {
  // 1. 定义传输方式：启动你自己的 bin 文件
  // 这里对应你之前 package.json 里的 mcp-cli
  const transport = new StdioClientTransport({
    command: "node",
    // 编译后的脚本绝对路径
    args: [scriptPath], // 或者使用 'npx', 'mcp-cli'
    env: { ...process.env } as Record<string, any>, // 确保环境变量传递
    stderr: "inherit",
  });

  // 2. 初始化客户端
  const client = new Client(
    {
      name: "my-mcp-inspector",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  // 3. 连接服务
  await client.connect(transport);

  // 4. 调用服务提供的 Tool (假设你的服务有个工具叫 'my-tool')
  await client.callTool({
    name: injectInfo.cliConfig.moduleName,
    arguments: {
      projectName: "test222",
      templateGitPath: "https://gitee.com/justsosu/template-web-pc-vue3.git",
    },
  });

  // eslint-disable-next-line no-restricted-syntax
  // console.log("MCP 服务返回结果:", result);
}

callMyMcpService().catch((error) =>
  // eslint-disable-next-line no-restricted-syntax
  console.log("出错了111", error?.message || error),
);
