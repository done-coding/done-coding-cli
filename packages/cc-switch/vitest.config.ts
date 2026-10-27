import path from "node:path";
import { defineConfig } from "vitest/config";

// 测试不加载 vite 的 generateFile 构建钩子，避免向 src 写生成物。
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { globals: true },
});
