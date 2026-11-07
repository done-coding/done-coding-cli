# @done-coding/cli-mcp

通过 MCP stdio 协议向 AI 客户端提供项目创建、具名实例生成和模块模板工具。不包含模型服务，也不需要由 server 发起模型调用。

## 安装与接入

```bash
npm install -g @done-coding/cli-mcp
```

在支持 MCP 的客户端配置中登记以下 server；具体配置文件位置由客户端决定：

```json
{
  "mcpServers": {
    "done-coding": {
      "command": "dc-mcp",
      "args": []
    }
  }
}
```

也可将 command 改为 `npx`，args 改为 `["-y", "@done-coding/cli-mcp"]`。server 是独立入口，不通过 `done-coding mcp` 启动。

## 可用能力

- 从本地模板列表资源选择模板，通过 prepare / complete 两步创建项目。
- 查询和操作 [generator](../generator/README.md) 的具名实例，执行模板组装。
- 查询模块模板及参数、构建代码树并检查产物。

模板发现资源为 `done-coding-create-template-list://{configPath}`，configPath 是本地配置文件路径；创建工具的 `templateUrl` 必填，不会回落全局模板指针或默认远端列表。创建项目仍可能克隆显式指定的远端模板。

客户端应显式提供目标项目目录和所需答案；工具按非交互模式执行，缺少必要数据时应补齐后重试。创建参数和模板列表格式见 [create 文档](../create/README.md)。

MIT 许可证。
