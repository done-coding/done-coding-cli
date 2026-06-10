/** MCP 工具返回的 JSON 文本结果 */
export interface McpJsonResult {
  content: {
    type: "text";
    text: string;
  }[];
}
