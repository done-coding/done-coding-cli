import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

export type { McpServer };

/** mcp服务 工具注册选项 */
export interface McpToolRegisterOptions<T extends object> {
  /** 工具名 */
  name: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 验证输入 */
  getInputSchema: (
    zInstance: typeof z,
  ) => ReturnType<typeof z.object<Record<keyof T, any>>>;
  /** 回调函数 */
  handler: Parameters<McpServer["registerTool"]>[2];
}

/** mcp服务 资源注册选项 */
export interface McpResourceRegisterOptions {
  /** 资源名 - 唯一标识 */
  name: string;
  /** 资源定义的url - 资源访问的 URI */
  url: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 回调函数 */
  handler: Parameters<McpServer["registerResource"]>[3];
}
/** mcp服务 提示词注册选项 */
export interface McpPromptRegisterOptions {
  /** 提示词名 */
  name: string;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** 回调函数 */
  handler: Parameters<McpServer["registerPrompt"]>[2];
}
