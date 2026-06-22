import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 与 vite.config 一致：源码内 `@/` 指向 src
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    // byte-identical 用例 spawn 真实 dc-component bin，放宽超时
    testTimeout: 60000,
    hookTimeout: 120000,
    // 共享构建产物与临时夹具，串行更稳
    fileParallelism: false,
  },
});
