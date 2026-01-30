/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-04-19 13:54:04
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-30 19:10:48
 */
import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import { builtinModules } from "node:module";
import { generateFile } from "@done-coding/cli-inject";
import { doneCodingCliConfig } from "@done-coding/cli-inject/helpers";

generateFile({ config: doneCodingCliConfig });

export default defineConfig(({ command, mode }) => {
  const isPro = command === "build" && mode !== "hotBuild";

  const inputList = ["src/index.ts", "src/cli.ts"];

  return {
    plugins: [
      dts({
        include: [
          "src/**/*.ts",
          "src/**/*.tsx",
          "src/**/*.d.ts",
          "src/**/*.json",
        ],
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
