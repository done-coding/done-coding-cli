module.exports = {
  extends: ["alloy", "alloy/vue", "alloy/typescript"],
  plugins: ["import"],
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: {
      js: "@babel/eslint-parser",
      jsx: "@babel/eslint-parser",

      ts: "@typescript-eslint/parser",
      tsx: "@typescript-eslint/parser",

      // Leave the template parser unspecified, so that it could be determined by `<script lang="...">`
    },
  },
  env: {
    // Your environments (which contains several predefined global variables)
    //
    // browser: true,
    // node: true,
    // mocha: true,
    // jest: true,
    // jquery: true
  },
  globals: {
    // Your global variables (setting to false means it's not allowed to be reassigned)
    //
    // myGlobal: false
  },
  rules: {
    // Customize your rules
    "vue/no-duplicate-attributes": [
      "error",
      {
        allowCoexistClass: true,
        allowCoexistStyle: true,
      },
    ],
    // vue 顺序
    "vue/order-in-components": [
      "error",
      {
        order: [
          "name",
          "functional",
          "inheritAttrs",
          "components",
          "directives",
          "filters",
          "mixins",
          "inject",
          "model",
          "props",
          "emits",
          "data",
          "provide",
          "computed",
          "methods",
          "setup",
          "LIFECYCLE_HOOKS",
          "watch",
          "render",
        ],
      },
    ],
    /** import 首位 */
    "import/first": "error",
    /** 禁止一个文件多个相同模块导入 */
    "import/no-duplicates": "error",
    /** 禁止导出可变变量 */
    "import/no-mutable-exports": "error",
  },
  overrides: [
    /** 处理.vue单文件组件没有包含script误报问题 */
    {
      files: ["*.vue"],
      rules: {
        "@typescript-eslint/consistent-type-assertions": "warn",
        "@typescript-eslint/consistent-type-imports": "warn",
      },
    },
  ],
};
