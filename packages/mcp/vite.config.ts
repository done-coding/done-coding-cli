/// <reference types="vitest" />
import type { BuildOptions } from "vite";
import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import { builtinModules } from "node:module";

const isPro = process.env.NODE_ENV === "production";

const inputList = ["src/index.ts", "src/test.ts"];

const build = {
  minify: isPro,
  emptyOutDir: true,
  target: "node16",
  rollupOptions: {
    external: [
      ...builtinModules,
      ...builtinModules.map((m) => `node:${m}`),
      ...Object.keys(pkg.dependencies || {}),
    ],
    input: inputList,
    output: [
      {
        format: "es",
        entryFileNames: "[name].mjs",
        dir: "./es",
        banner: `#!/usr/bin/env node`,
      },
    ],
  },
  lib: {
    entry: inputList,
  },
} satisfies BuildOptions;

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "istanbul", // or 'v8'
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts?(x)"],
    },
  },
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
      exclude: ["**/__tests__/**"],
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
