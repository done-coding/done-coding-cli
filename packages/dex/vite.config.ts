/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import { builtinModules } from "node:module";
import { generateFile } from "@done-coding/cli-inject";
import { doneCodingCliConfig } from "@done-coding/cli-inject/helpers";

// build/dev 时同步生成 src/injectInfo.json（对齐 mcp/cc-switch，不依赖 prebuild 的 dc-inject bin）
generateFile({
  config: doneCodingCliConfig,
  keyConfigMap: {
    "cliConfig.moduleName": "dex",
  },
});

export default defineConfig(({ command, mode }) => {
  const isPro = command === "build" && mode !== "hotBuild";

  const inputList = ["src/index.ts", "src/cli.ts"];

  return {
    test: {
      globals: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        include: ["src/**/*.ts?(x)"],
      },
    },
    plugins: [
      dts({
        include: [
          "src/**/*.ts",
          "src/**/*.tsx",
          "src/**/*.d.ts",
          "src/**/*.json",
        ],
        exclude: ["**/__tests__/**"],
        outDir: "./types",
        rollupTypes: isPro,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    json: {
      namedExports: false,
      stringify: false,
    },
    build: {
      minify: isPro,
      emptyOutDir: true,
      target: "node16",
      lib: {
        entry: inputList,
      },
      rollupOptions: {
        // external 用函数匹配：包名 + 子路径（如 @earendil-works/pi-ai/providers/all）
        // 数组精确匹配会漏子路径 import，导致外部包被误打包
        external: (id: string) => {
          if (builtinModules.includes(id) || id.startsWith("node:")) {
            return true;
          }
          return Object.keys({
            ...(pkg.dependencies || {}),
            ...(pkg.peerDependencies || {}),
          }).some((name) => id === name || id.startsWith(`${name}/`));
        },
        input: inputList,
        output: [
          {
            format: "es",
            entryFileNames: "[name].mjs",
            dir: "./es",
            banner: `#!/usr/bin/env node`,
            ...(isPro
              ? {}
              : {
                  preserveModules: true,
                  preserveModulesRoot: "src",
                }),
          },
        ],
      },
    },
  };
});
