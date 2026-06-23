/**
 * [T5] dc-generator init 生成的批次骨架内容（design §4.5，R9/L3）。
 *
 * 产出 init 写盘的 index.json + config.json5（含注释头）；template/ 占位由 init handler 落地。
 * 注释头列 4 策略 create/append/inject/replace（inject = P2 已交付：锚点插入 + marker 健壮回退）。
 * helper 白名单 5 个，零新增依赖（K6）。
 *
 * 实现注意：注释头/示例里的 `${...}` 是给批次作者看的**字面示例**，故用单引号字符串数组拼接，
 * 避免被本文件 JS 模板字面量插值（[MUST NOT] 用反引号写带 ${} 的行）。
 * 这些字面 `${}` 会触发 no-template-curly-in-string，本文件整体豁免该规则（属预期字面量）。
 */
/* eslint-disable no-template-curly-in-string */

/** init 骨架产物 */
export interface InitSkeleton {
  /** index.json 内容 */
  indexJson: Record<string, unknown>;
  /** config.json5 文本（含注释头） */
  configJson5: string;
}

/** config.json5 顶部注释头（K6/L3） */
const COMMENT_HEADER: string[] = [
  "// ─────────────────────────────────────────────────────────────",
  "// done-coding 批次配置（dc-generator add|remove <type> <name> / dc-generator list [type]）",
  "// ── helper 速查（白名单 5 个，零新增依赖）：",
  "//    ${_.camelCase(x)} ${_.kebabCase(x)} ${_.upperFirst(x)} ${_.lowerFirst(x)} ${_.pascalCase(x)}",
  "// ── 内建变量：",
  "//    ${name}(=PascalCase) ${namePascal} ${nameCamel} ${nameLowerFirst} ${nameKebab} ${rawName} ${execDir} ${templateDir} ${$}",
  "// ── 策略速查：create(建/覆盖) | append(末尾追加) | inject(锚点插入+marker健壮回退) | replace(原地改写,无自动 remove)",
  "//    // inject 需 anchor:{pattern,position:before|after,patternType?:literal|regex}；markerKey 缺省=<批次>:<name>，回退按 marker 精确删、免疫块内手改",
  "// ── 用 replace 的批次不可自动 remove；inject/append/create 可自动 remove",
  "// ─────────────────────────────────────────────────────────────",
];

/** 生成 init 骨架（按批次类型名定制示例） */
export const buildInitSkeleton = (type: string): InitSkeleton => {
  // config.json5 主体（示例 collectEnvDataForm + globalEnvData + files）。
  // 同样用字符串数组拼接，保持示例里的 ${} 字面。
  const body: string[] = [
    "{",
    "  // 实例落地目录（落 execDir，可含 ${} 变量；查重 & remove 基于它）",
    '  instanceDir: "${execDir}/src/' + type + '/${nameKebab}",',
    "  // 删除时实例子目录为空则删除（默认 false）",
    "  removeEmptyDir: false,",
    "  // list 枚举方式：扫子目录 / none",
    '  list: { mode: "subdir", nameExcludes: [] },',
    "  // 名称排除 / 保留",
    "  nameExcludes: [],",
    "  // 参数采集（initial 可引用前序已答变量，${} 渲染、有序累积、fail-fast）",
    "  collectEnvDataForm: [",
    '    // { name: "desc", message: "请输入描述" },',
    "  ],",
    "  // 全局环境变量（声明式派生变量，用 ${_.x(...)} 表达）",
    "  globalEnvData: {",
    '    // example: "${_.pascalCase(name)}",',
    "  },",
    "  // 文件条目（content-free，按声明顺序串行处理；strategy 缺省 = create）",
    "  files: [",
    "    {",
    '      input: "${templateDir}/template/index.ts.md",',
    '      output: "${execDir}/src/' + type + '/${nameKebab}/index.ts",',
    '      strategy: "create",',
    "      // 是否剥离 markdown code fence（content-free）",
    "      dealMarkdown: true,",
    "    },",
    "    // inject 示例：向既有文件锚点插入被 marker 包裹的块（可自动 remove）",
    "    // {",
    '    //   inputData: "  ${nameCamel}Route,",',
    '    //   output: "${execDir}/src/router/routes.ts",',
    '    //   strategy: "inject",',
    '    //   anchor: { pattern: "const routes = [", position: "after" },',
    "    //   // markerKey 缺省 = <批次>:<name>，多块插同文件须显式区分",
    "    // },",
    "  ],",
    "  // 批次实例 list 序列化形状（list -o 落地）",
    '  listSerializer: { fields: ["name", "nameKebab"], sort: false, indent: 2, pathResolveBase: "cwd" },',
    "  // list -o 输出 json 路径（按 cwd path.resolve）",
    '  // nameListJsonOutputPath: "./src/' + type + '/name-list.json",',
    "}",
  ];

  return {
    indexJson: { config: "./config.json5" },
    configJson5: [...COMMENT_HEADER, ...body, ""].join("\n"),
  };
};

/** template/ 占位文件名 + 内容（init 落地一个示例模板，复刻 dealMarkdown fence 形态） */
export const buildInitTemplatePlaceholder = (): {
  fileName: string;
  content: string;
} => {
  return {
    fileName: "index.ts.md",
    content: [
      "```ts",
      "// ${name} —— 由 dc-generator 生成（这是占位模板，按需修改）",
      "export const ${nameCamel} = () => {};",
      "```",
      "",
    ].join("\n"),
  };
};
