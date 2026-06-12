import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 与 vite.config 一致：源码内 `@/` 指向 src，便于直测纯函数而无需先构建本包
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    // e2e 用例会 spawn 真实 CLI + git，放宽单用例超时
    testTimeout: 60000,
    hookTimeout: 120000,
    // e2e 共享构建产物与临时模板，串行更稳
    fileParallelism: false,
  },
});
