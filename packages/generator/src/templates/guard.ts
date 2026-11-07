/**
 * tree 生成前校验（dyynp0）：生成那一刻的两道机械闸，替代靠提示词约束 AI 填参。
 *
 *  - 参数闸：recipe.vars 按所引模板 schema.json 的 `params`（JSON Schema）校验，
 *    一次列出全部违规（路径 + 期望 + 实际）。校验器 = ajv（按 `$schema` 选 draft）。
 *  - 基座闸：schema 声明 `base: { package, range }` 时，从 recipe.output 所在目录向上至
 *    gitRoot 就近找 `node_modules/<package>/package.json`，已装版本不在 range 内即拒绝。
 *    项目里找不到该包（如 Python 基座 fastapi）→ 无法确认，告警不阻断。
 *  - 配方 → 模板：addFragment `source` 约定 `<base>/<template>/fragments/<file>`
 *    （相对 templates 根），据前两段定位模板目录；不在模板资产层的配方不校验。
 *
 * 任一违规 → CliUserError（零落盘：调用方须在任何写盘前调用）。
 */
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
// 子路径带 .js：ajv 无 exports 字段，Node ESM 不补扩展名
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import semver from "semver";
import { CliUserError, outputConsole } from "@done-coding/cli-utils";
import type { Recipe } from "@/assemble/types";
import { isInside } from "@/core/path-safe";
import { readTemplateSchema } from "./discover";
import type { TemplateSchema } from "./types";

/** 配方引用的模板 */
export interface RecipeTemplateRef {
  /** `<base>/<template>` */
  id: string;
  /** 模板目录绝对路径 */
  dir: string;
  schema: TemplateSchema;
}

/** 由 addFragment source 推导配方引用的模板（去重，按出现顺序） */
export const collectRecipeTemplates = (
  recipe: Recipe,
  templatesRoot: string | undefined,
): RecipeTemplateRef[] => {
  if (!templatesRoot) return [];
  const refs = new Map<string, RecipeTemplateRef>();
  for (const op of recipe.ops) {
    if (op.type !== "addFragment" || typeof op.source !== "string") continue;
    const [base, name, third] = op.source.split(/[\\/]/);
    if (!base || !name || third !== "fragments") continue;
    const id = `${base}/${name}`;
    if (refs.has(id)) continue;
    const dir = path.resolve(templatesRoot, base, name);
    if (
      !isInside(templatesRoot, dir) ||
      !fs.existsSync(path.join(dir, "schema.json"))
    ) {
      continue;
    }
    refs.set(id, { id, dir, schema: readTemplateSchema(dir) });
  }
  return [...refs.values()];
};

/** 按 `$schema` 选 ajv 实例（默认 draft-07）；strict 关闭以容忍模板里的扩展关键字 */
const compileParams = (params: Record<string, unknown>): ValidateFunction => {
  const draft = typeof params.$schema === "string" ? params.$schema : "";
  const options = { allErrors: true, strict: false, logger: false } as const;
  if (draft.includes("2020-12")) return new Ajv2020(options).compile(params);
  if (draft.includes("2019-09")) return new Ajv2019(options).compile(params);
  return new Ajv(options).compile(params);
};

/** 按 JSON Pointer 取值（`~1` → `/`，`~0` → `~`） */
const valueAt = (root: unknown, pointer: string): unknown =>
  pointer
    .split("/")
    .slice(1)
    .reduce<unknown>((acc, raw) => {
      if (acc === null || typeof acc !== "object") return undefined;
      const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
      return (acc as Record<string, unknown>)[key];
    }, root);

const show = (value: unknown): string =>
  value === undefined ? "缺失" : JSON.stringify(value);

/** 单条 ajv 错误 → 「路径：期望 …；实际 …」 */
const describeError = (error: ErrorObject, vars: unknown): string => {
  const { keyword, instancePath, params, message } = error;
  if (keyword === "required") {
    const field = `${instancePath}/${String(params.missingProperty)}`;
    return `${field}：期望 必填；实际 缺失`;
  }
  if (keyword === "additionalProperties") {
    const field = `${instancePath}/${String(params.additionalProperty)}`;
    return `${field}：期望 不允许该字段；实际 ${show(valueAt(vars, field))}`;
  }
  const expected =
    keyword === "type"
      ? `类型 ${String(params.type)}`
      : keyword === "enum"
        ? `取值之一 ${JSON.stringify(params.allowedValues)}`
        : keyword === "const"
          ? `等于 ${JSON.stringify(params.allowedValue)}`
          : `${keyword}（${message ?? ""}）`;
  return `${instancePath || "/"}：期望 ${expected}；实际 ${show(
    valueAt(vars, instancePath),
  )}`;
};

/** 参数闸：返回该模板下的全部违规描述 */
const validateVars = (
  ref: RecipeTemplateRef,
  vars: Record<string, unknown>,
): string[] => {
  let validate: ValidateFunction;
  try {
    validate = compileParams(ref.schema.params);
  } catch (error) {
    return [
      `模板 schema.json 的 params 不是合法 JSON Schema：${path.join(
        ref.dir,
        "schema.json",
      )}（${error instanceof Error ? error.message : String(error)}）`,
    ];
  }
  if (validate(vars)) return [];
  return (validate.errors ?? []).map((error) => describeError(error, vars));
};

/** 从 startDir 向上至 stopDir（含）就近找已装包的 package.json */
const findInstalledVersion = (
  pkg: string,
  startDir: string,
  stopDir: string,
): { version: string; manifest: string } | undefined => {
  let dir = startDir;
  for (;;) {
    const manifest = path.join(dir, "node_modules", pkg, "package.json");
    if (fs.existsSync(manifest)) {
      const { version } = JSON.parse(fs.readFileSync(manifest, "utf-8")) as {
        version?: unknown;
      };
      if (typeof version === "string") return { version, manifest };
    }
    if (dir === stopDir) return undefined;
    const parent = path.dirname(dir);
    if (parent === dir || !isInside(stopDir, parent)) return undefined;
    dir = parent;
  }
};

/** 基座闸：返回违规描述（未装 → 告警，返回空） */
const checkBase = (
  ref: RecipeTemplateRef,
  recipe: Recipe,
  gitRoot: string,
): string[] => {
  const { base } = ref.schema;
  if (!base) return [];
  const schemaPath = path.join(ref.dir, "schema.json");
  if (!semver.validRange(base.range)) {
    return [
      `基座范围不是合法 semver range：base.range「${base.range}」（${schemaPath}）`,
    ];
  }
  const outputDir = path.resolve(gitRoot, recipe.output);
  const startDir = isInside(gitRoot, outputDir) ? outputDir : gitRoot;
  const installed = findInstalledVersion(base.package, startDir, gitRoot);
  if (!installed) {
    outputConsole.warn(
      `模板「${ref.id}」声明基座 ${base.package}@${base.range}，但项目 node_modules 中未找到该包，跳过基座版本校验（非 npm 基座暂不支持校验）`,
    );
    return [];
  }
  if (semver.satisfies(installed.version, base.range)) return [];
  return [
    `基座版本不符：模板适配 ${base.package}@${base.range}，项目已装 ${installed.version}（${path.relative(gitRoot, installed.manifest)}）。请升级 / 调整 ${base.package} 到该范围，或换用适配 ${installed.version} 的模板版本`,
  ];
};

/**
 * 对全部配方跑参数闸 + 基座闸；有任何违规 → 抛 CliUserError 汇总列出。
 * [MUST] 在任何写盘前调用（零落盘）。
 */
export const assertRecipesGuarded = (
  recipes: Recipe[],
  opts: { gitRoot: string; templatesRoot: string | undefined },
): void => {
  const sections: string[] = [];
  for (const recipe of recipes) {
    for (const ref of collectRecipeTemplates(recipe, opts.templatesRoot)) {
      const problems = [
        ...checkBase(ref, recipe, opts.gitRoot),
        ...validateVars(ref, recipe.vars ?? {}),
      ];
      if (problems.length) {
        sections.push(
          `配方「${recipe.id}」× 模板「${ref.id}」：\n${problems
            .map((item) => `  - ${item}`)
            .join("\n")}`,
        );
      }
    }
  }
  if (sections.length) {
    throw new CliUserError(
      `tree 生成前校验未通过（未写入任何文件）：\n${sections.join("\n")}`,
    );
  }
};
