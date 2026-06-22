/**
 * 配方加载 / 校验 + recipeDir/fragmentRoot 约定（Wave C0，design §3 / §14 D-L1 / D-L2）。
 *
 *  - loadRecipe(absPath)：JSON5 解析（复用 cli-utils json5）→ 结构校验（必填 id/base/output/ops；
 *    op id 配方内唯一；each op 有 type/target；jsonMerge/deleteField source/target/pointer 约束）。
 *    fail-loud（throw，[MUST NOT] process.exit）。
 *  - discoverRecipes(cwd)：约定 `<cwd>/assemble/recipes/*.json5`（--all 用，字典序）。
 *  - recipeDir / fragmentRoot 约定（§3.3）。
 */
import fs from "node:fs";
import path from "node:path";
import { json5 } from "@done-coding/cli-utils";
import type { AssembleOp, Recipe, RecipeBase } from "./types";

/** 约定：配方根目录 `<cwd>/assemble/recipes`（§3.3）。 */
export const recipeDir = (cwd: string): string =>
  path.resolve(cwd, "assemble", "recipes");

/** 约定：碎片根目录 `<cwd>/assemble/fragments`（§3.3，readFragment 越界基准）。 */
export const fragmentRoot = (cwd: string): string =>
  path.resolve(cwd, "assemble", "fragments");

/** 发现约定目录下全部 `*.json5` 配方（绝对路径，字典序；目录不存在返回空）。 */
export const discoverRecipes = (cwd: string): string[] => {
  const dir = recipeDir(cwd);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".json5"))
    .sort()
    .map((n) => path.join(dir, n));
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** 校验 base 字段形态（empty / dir+from）。 */
const validateBase = (base: unknown, label: string): RecipeBase => {
  if (!isPlainObject(base)) {
    throw new Error(
      `${label}：base [MUST] 为对象（{kind:"empty"} 或 {kind:"dir",from}）`,
    );
  }
  if (base.kind === "empty") return { kind: "empty" };
  if (base.kind === "dir") {
    if (typeof base.from !== "string" || base.from.length === 0) {
      throw new Error(`${label}：base.kind="dir" [MUST] 带非空 from`);
    }
    const exclude = Array.isArray(base.exclude)
      ? (base.exclude as string[])
      : undefined;
    return { kind: "dir", from: base.from, ...(exclude ? { exclude } : {}) };
  }
  throw new Error(
    `${label}：base.kind [MUST] 为 "empty" 或 "dir"，收到 ${JSON.stringify(base.kind)}`,
  );
};

/** 校验单个 op（type/id/target 必填 + 子类型专有约束 D-L1）。 */
const validateOp = (raw: unknown, idx: number, label: string): AssembleOp => {
  if (!isPlainObject(raw)) {
    throw new Error(`${label}：ops[${idx}] [MUST] 为对象`);
  }
  const where = `${label}：ops[${idx}]`;
  if (typeof raw.type !== "string" || raw.type.length === 0) {
    throw new Error(`${where} 缺 type（registry 键）`);
  }
  if (typeof raw.id !== "string" || raw.id.length === 0) {
    throw new Error(
      `${where}(type=${raw.type}) 缺 id（配方内唯一 provenance）`,
    );
  }
  if (typeof raw.target !== "string" || raw.target.length === 0) {
    throw new Error(`${where}(id=${raw.id}) 缺 target`);
  }
  validateOpSpecifics(raw, where);
  return raw as AssembleOp;
};

/** 子类型专有约束：jsonMerge/deleteField source/target/pointer 须为 .json（D-L1）。 */
const validateOpSpecifics = (
  op: Record<string, unknown>,
  where: string,
): void => {
  if (op.type === "jsonMerge") {
    requireJsonExt(op.source, `${where} jsonMerge.source`);
    requireJsonExt(op.target, `${where} jsonMerge.target`);
  }
  if (op.type === "deleteField") {
    requireJsonExt(op.target, `${where} deleteField.target`);
    if (typeof op.pointer !== "string" || !op.pointer.startsWith("/")) {
      throw new Error(
        `${where} deleteField 缺合法 pointer（RFC 6901，以 / 开头）`,
      );
    }
  }
  if (
    (op.type === "addFragment" || op.type === "textPatch") &&
    (typeof op.source !== "string" || op.source.length === 0)
  ) {
    throw new Error(`${where} ${op.type} 缺 source`);
  }
};

const requireJsonExt = (v: unknown, label: string): void => {
  if (typeof v !== "string" || !v.endsWith(".json")) {
    throw new Error(`${label} [MUST] 为 .json（D-L1）：${JSON.stringify(v)}`);
  }
};

/** 校验 op id 配方内唯一。 */
const assertUniqueOpIds = (ops: AssembleOp[], label: string): void => {
  const seen = new Map<string, number>();
  ops.forEach((op, idx) => {
    const prev = seen.get(op.id);
    if (prev !== undefined) {
      throw new Error(
        `${label}：op id「${op.id}」重复（ops[${prev}] 与 ops[${idx}]，须配方内唯一，C1）`,
      );
    }
    seen.set(op.id, idx);
  });
};

/** 校验 createTemplate 同步声明（可选）。 */
const validateCreateTemplate = (
  raw: unknown,
  label: string,
): Recipe["createTemplate"] => {
  if (raw === undefined) return undefined;
  if (!isPlainObject(raw)) {
    throw new Error(`${label}：createTemplate [MUST] 为对象`);
  }
  if (typeof raw.configPath !== "string" || raw.configPath.length === 0) {
    throw new Error(`${label}：createTemplate 缺 configPath`);
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new Error(`${label}：createTemplate 缺 name`);
  }
  return {
    configPath: raw.configPath,
    name: raw.name,
    ...(typeof raw.description === "string"
      ? { description: raw.description }
      : {}),
  };
};

/** 校验已解析对象为合法 Recipe（结构 + 唯一性 + 子类型约束）。 */
export const validateRecipe = (parsed: unknown, label: string): Recipe => {
  if (!isPlainObject(parsed)) {
    throw new Error(`${label}：配方根 [MUST] 为对象`);
  }
  if (typeof parsed.id !== "string" || parsed.id.length === 0) {
    throw new Error(`${label}：缺 id（产物稳定标识）`);
  }
  if (typeof parsed.output !== "string" || parsed.output.length === 0) {
    throw new Error(`${label}：缺 output（物化产物落地目录）`);
  }
  if (!Array.isArray(parsed.ops)) {
    throw new Error(`${label}：缺 ops 数组`);
  }
  const base = validateBase(parsed.base, label);
  const ops = parsed.ops.map((op, idx) => validateOp(op, idx, label));
  assertUniqueOpIds(ops, label);
  const vars = isPlainObject(parsed.vars)
    ? (parsed.vars as Record<string, unknown>)
    : undefined;
  const createTemplate = validateCreateTemplate(parsed.createTemplate, label);
  return {
    id: parsed.id,
    base,
    output: parsed.output,
    ops,
    ...(vars ? { vars } : {}),
    ...(createTemplate ? { createTemplate } : {}),
  };
};

/**
 * 加载并校验配方文件（JSON5）。fail-loud（throw）。
 *  - absPath 不存在 → throw（C1 边界）。
 *  - JSON5 解析失败 → throw（带文件名）。
 *  - 结构/唯一性/子类型约束 → throw（带 op 定位）。
 */
export const loadRecipe = (absPath: string): Recipe => {
  const resolved = path.resolve(absPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`配方文件不存在：${resolved}`);
  }
  const text = fs.readFileSync(resolved, "utf-8");
  let parsed: unknown;
  try {
    parsed = json5.parse(text);
  } catch (err) {
    throw new Error(
      `配方 JSON5 解析失败：${resolved}\n  ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return validateRecipe(parsed, `配方 ${path.basename(resolved)}`);
};
