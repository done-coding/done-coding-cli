import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function callMyMcpService() {
  // 1. 定义传输方式：启动你自己的 bin 文件
  // 这里对应你之前 package.json 里的 mcp-cli
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./es/index.mjs"], // 或者使用 'npx', 'mcp-cli'
    env: { ...process.env } as Record<string, any>, // 确保环境变量传递
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
  const result = await client.callTool({
    name: "create",
    arguments: {
      projectName: "test222",
      templateGitPath: "https://gitee.com/justsosu/template-web-pc-vue3.git",
    },
  });

  // eslint-disable-next-line no-restricted-syntax
  console.log("MCP 服务返回结果:", result);
}

// eslint-disable-next-line no-restricted-syntax
callMyMcpService().catch((error) =>
  console.log("出错了", error?.message || error),
);
