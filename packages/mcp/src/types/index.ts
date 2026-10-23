/** MCP 工具返回的 JSON 文本结果 */
export interface McpJsonResult {
  content: {
    type: "text";
    text: string;
  }[];
  /** 对齐 SDK CallToolResult 的 index signature（TS2345 赋值兼容所需） */
  [key: string]: unknown;
}
