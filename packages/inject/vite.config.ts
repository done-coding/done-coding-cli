import type { BuildOptions } from "vite";
import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import { builtinModules } from "node:module";
import { doneCodingCliConfig } from "./src/helpers-assets/done-coding";
import { generateFile } from "./src/handlers/generate";

const isPro = process.env.NODE_ENV === "production";

const build = {
  minify: isPro,
  target: "node16",
  rollupOptions: {
    external: [
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
      ...Object.keys(pkg.dependencies || {}),
    ],
    input: ["src/index.ts", "src/cli.ts", "src/helpers.ts"],
    output: [
      {
        format: "es",
        entryFileNames: "[name].mjs",
        // preserveModules: true,
        dir: "./es",
        // preserveModulesRoot: "src",
        banner: `#!/usr/bin/env node`,
      },
    ],
  },
  lib: {
    entry: ["src/index.ts", "src/cli.ts", "src/helpers.ts"],
  },
} satisfies BuildOptions;

generateFile({ config: doneCodingCliConfig });

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    dts({
      include: [
        "./src/*.ts",
        "./src/*.d.ts",
        "./src/**/*.ts",
        "./src/**/*.tsx",
        "./src/**/*.d.ts",
        "./src/**/*.json",
      ],
      outDir: "./types",
      rollupTypes: true,
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
  build,
});
