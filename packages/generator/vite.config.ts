import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import { builtinModules } from "node:module";
import { generateFile } from "@done-coding/cli-inject";
import { doneCodingCliConfig } from "@done-coding/cli-inject/helpers";

// 比照 component/create：从 package.json 同步生成 src/injectInfo.json。
// moduleName 由默认正则从包名派生为 "generator"（content-free，批次类型是运行时参数，
// 不以 moduleName 选批次，故无需像 create 那样 keyConfigMap 覆盖）。
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
