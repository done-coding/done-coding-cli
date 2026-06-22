import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 与 vite.config 一致：源码内 `@/` 指向 src，便于直测注册逻辑而无需先构建本包
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
