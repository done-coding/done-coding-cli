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
    // 隔离宿主 HOME（夹具自包含）：forks 池使 globalSetup 设的 HOME 对 os.homedir() 生效
    pool: "forks",
    globalSetup: ["__tests__/setup/isolate-home.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
