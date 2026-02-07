/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-30 22:23:16
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-03 21:22:38
 */
import { setupMcpServer } from "create-done-coding";
// // MCP 使用 stdin/stdout 做 JSON-RPC 通信，启动后禁止向 stdout 写入（包括 console.log）
// // 错误输出到 stderr，不影响 MCP 协议
await setupMcpServer();
