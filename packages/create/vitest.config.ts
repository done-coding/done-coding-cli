import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // e2e 用例会 spawn 真实 CLI + git，放宽单用例超时
    testTimeout: 60000,
    hookTimeout: 120000,
    // e2e 共享构建产物与临时模板，串行更稳
    fileParallelism: false,
  },
});
