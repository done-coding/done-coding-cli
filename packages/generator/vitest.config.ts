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
    include: ["__tests__/**/*.test.ts"],
    // e2e 用例会 spawn 真实 CLI，放宽单用例超时
    testTimeout: 60000,
    hookTimeout: 120000,
    // e2e 共享构建产物与临时夹具，串行更稳
    fileParallelism: false,
    coverage: {
      provider: "v8",
      // 只盯 assemble 机制层 + handler（其余面各自基准，避免稀释）
      include: ["src/assemble/**", "src/handlers/assemble.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
});
