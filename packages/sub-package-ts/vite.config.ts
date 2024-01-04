/// <reference types="vitest" />
import type { BuildOptions } from "vite";
import { defineConfig } from "vite";
import path from "node:path";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
import lodash from "lodash";

const isPro = process.env.NODE_ENV === "production";

const build = {
  minify: isPro,
  emptyOutDir: true,
  rollupOptions: {
    external: [
      ...Object.keys(lodash).map((key) => `lodash/${key}`),
      ...Object.keys(pkg.dependencies),
    ],
    input: ["src/index.ts"],
    output: [
      {
        format: "es",
        entryFileNames: "[name].js",
        preserveModules: true,
        dir: "./es",
        preserveModulesRoot: "src",
      },
      {
        format: "cjs",
        exports: "named",
        entryFileNames: "[name].js",
        preserveModules: true,
        dir: "./lib",
        preserveModulesRoot: "src",
      },
    ],
  },
  lib: {
    entry: "./src/index.ts",
  },
} satisfies BuildOptions;

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "istanbul", // or 'v8'
      reporter: ["text", "json", "html"],
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
      outDir: "./types",
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
