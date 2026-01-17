module.exports = {
  root: true,
  extends: ["alloy", "alloy/typescript"],
  plugins: ["import", "regexp"],
  parser: "@typescript-eslint/parser",
  parserOptions: {},
  env: {
    browser: true,
    node: true,
  },
  globals: {
    // 可以在此添加自定义全局变量
  },
  rules: {
    /** import 规范 */
    "import/first": "error",
    "import/no-duplicates": "warn",
    "import/no-mutable-exports": "error",

    /** TypeScript 规则 */
    // 允许定义空接口 (如 interface A extends B {})
    "@typescript-eslint/no-empty-interface": "off",
    // 强制使用 as 风格的类型断言
    "@typescript-eslint/consistent-type-assertions": "warn",
    // 强制使用 import type 导入类型声明
    "@typescript-eslint/consistent-type-imports": "warn",

    /** 正则表达式规范 */
    "regexp/no-useless-escape": "warn",
    "regexp/no-useless-character-class": "warn"
  },
  overrides: [],
  // 合并了两个数组，确保所有目录都被忽略
  ignorePatterns: [
    "node_modules",
    "dist",
    "dist-electron",
    "build",
    "es",
    "lib",
    "types",
    "locales",
    "styles",
    "coverage",
    "**/__test__/**",
    "**/jest.config.js",
    "**/index.html"
  ],
};
