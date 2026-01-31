/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-04-19 13:54:04
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-31 12:10:09
 */
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
    "regexp/no-useless-character-class": "warn",
  },
  overrides: [
    {
      // 仅针对源代码目录下的 ts/js 文件生效
      files: ["packages/**/src/**/*.{ts,tsx,js,jsx}"],
      rules: {
        // 1. 显式关闭插件可能自带的 no-console
        "no-console": "off",
        // 2. 强制应用自定义的报错提示
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "Identifier[name='console'][parent.type='MemberExpression']",
            message: `❌ 请从utils包导出 log 代替 console, 
-------
即需要考虑MCP服务环境额外输出问题`,
          },
          {
            // 拦截：process.on(...) 和 process.once(...) 的【顶层】调用
            selector:
              "Program > ExpressionStatement > CallExpression[callee.object.name='process'][callee.property.name=/^(on|once)$/]",
            message:
              "检测到【顶层】进程事件监听（on/once）！这会被 Tree-shaking 误删，请移入 src/_init/ 隔离区并声明 sideEffects。",
          },
          {
            // 拦截：window.a = 1, global.b = 2, globalThis.c = 3 的【顶层】赋值
            selector:
              "Program > ExpressionStatement > AssignmentExpression[left.object.name=/^(window|global|globalThis)$/]",
            message: "禁止在【顶层】直接污染全局变量。请使用隔离的初始化模块。",
          },
          {
            // 拦截：Object.defineProperty(global, ...) 的【顶层】调用
            selector:
              "Program > ExpressionStatement > CallExpression[callee.object.name='Object'][callee.property.name='defineProperty'][arguments.0.name=/^(global|window|globalThis)$/]",
            message:
              "检测到【顶层】全局属性注入！请将其物理隔离并声明 sideEffects。",
          },
          {
            // 拦截：顶层的定时器（通常用于长驻后台的任务，不经导出极易失效）
            selector:
              "Program > ExpressionStatement > CallExpression[callee.name=/^(setInterval|setTimeout)$/]",
            message:
              "检测到【顶层】定时器！若此任务必须执行，请移入 _init 隔离区。",
          },
        ],
      },
    },
  ],
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
    "**/index.html",
  ],
};
