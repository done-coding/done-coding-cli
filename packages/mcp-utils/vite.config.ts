/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-30 08:55:40
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-30 19:15:50
 */
/// <reference types="vitest" />
import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import { builtinModules } from "node:module";

export default defineConfig(({ command, mode }) => {
  const isPro = command === "build" && mode !== "hotBuild";

  const inputList = ["src/index.ts"];

  return {
    test: {
      globals: true,
      environment: "node",
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
      target: "node16",
      lib: {
        entry: inputList,
      },
      rollupOptions: {
        external: [
          ...builtinModules,
          ...builtinModules.map((m) => `node:${m}`),
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.peerDependencies || {}),
          /^@modelcontextprotocol\/sdk(\/.*)?$/,
        ],
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
