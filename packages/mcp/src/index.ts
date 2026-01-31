/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-30 22:23:16
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-31 16:42:16
 */
import { setupMcpServer } from "create-done-coding";

await setupMcpServer().catch(() => {
  process.exit(1);
});
