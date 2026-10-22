/**
 * 模板资产层发现（T5，codegen-unified §三-补，裁决 ⓑⓒⓓ）。
 *
 * - `discoverTemplates(base, cwd)`：资产即列表——扫各层 `.done-coding/templates/<base>/` 的
 *   立即子目录 = 模板，按模板名去重、就近优先（project > parent > global），每名一条 + 获胜层。
 * - 就近向上 + 全局原语 = `listDoneCodingDirs("templates", { cwd })`（@done-coding/cli-utils
 *   dir-resolver），[MUST NOT] 重实现祖先链遍历。
 * - schema.json 缺失 / 非法 → fail-loud 指名模板目录（ⓓ，对齐批次层「非法批次」先例），
 *   [MUST NOT] 静默丢弃。`<base>/` 不存在 → 返回 []（非 fail）。
 */
import fs from "node:fs";
import path from "node:path";
import {
  json5,
  listDoneCodingDirs,
  type DoneCodingDirHit,
} from "@done-coding/cli-utils";
import { realpathOrResolve } from "@/core/path-safe";
import type { TemplateInfo, TemplateSchema } from "./types";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * 读单模板 schema.json（ⓑ 单一事实源；ⓓ 缺失/非法 fail-loud 指名模板目录）。
 * `params` 为契约必填（JSON Schema 对象），缺失视为 schema 非法 fail-loud。
 */
export const readTemplateSchema = (templateDir: string): TemplateSchema => {
  const schemaPath = path.join(templateDir, "schema.json");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`模板缺少 schema.json：${templateDir}`);
  }
  let raw: unknown;
  try {
    raw = json5.parse(fs.readFileSync(schemaPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `模板 schema.json 解析失败：${schemaPath}（${
        error instanceof Error ? error.message : String(error)
      }）`,
    );
  }
  if (!isPlainObject(raw)) {
    throw new Error(`模板 schema.json 须为对象：${schemaPath}`);
  }
  if (!isPlainObject(raw.params)) {
    throw new Error(
      `模板 schema.json 缺少 params（JSON Schema 对象，recipe.vars 契约）：${schemaPath}`,
    );
  }
  return {
    whenToUse: typeof raw.whenToUse === "string" ? raw.whenToUse : undefined,
    params: raw.params,
    ...(isPlainObject(raw.defaults) ? { defaults: raw.defaults } : {}),
  };
};

/** 扫单个 templates 根下 `<base>/` 的立即子目录 = 模板（隐藏目录跳过，对齐批次层 R2）。 */
const scanTemplatesOfRoot = (
  root: DoneCodingDirHit,
  base: string,
): Array<{ name: string; templateDir: string }> => {
  const baseDir = path.join(root.realDir, base);
  if (!fs.existsSync(baseDir)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    // 该层无法枚举 → 跳过该层（对齐 resolver「错误聚合：部分非法不中断整体」）
    return [];
  }
  return entries
    .filter(
      (ent) =>
        !ent.name.startsWith(".") &&
        (ent.isDirectory() || ent.isSymbolicLink()),
    )
    .map((ent) => ({
      name: ent.name,
      templateDir: realpathOrResolve(path.join(baseDir, ent.name)),
    }));
};

/**
 * 发现 `templates/<base>/` 下全部模板（资产即列表，ⓒ）。
 * - 各 `.done-coding/templates/` 根（就近向上 + 全局，listDoneCodingDirs 返回由近及远）逐一扫
 *   `<base>/` 的立即子目录 = 模板；按模板名去重，**就近优先**（project > parent > global），
 *   每名一条 + 获胜层（跨层同名仅保留更近层；异名并集列出）。
 * - `<base>/` 不存在 / 无 templates 根 → 返回 []（非 fail）。
 * - 结果按模板名排序（确定性，MCP 列表友好）。
 * @param base 基座名（templates 下分类，如 `admin-core`）
 * @param cwd 起始目录（就近向上基准）
 * @param opts.home 全局层 HOME（测试 fake HOME 用，隔离真实 ~/.done-coding）
 */
export const discoverTemplates = (
  base: string,
  cwd: string,
  opts?: { home?: string },
): TemplateInfo[] => {
  const roots = listDoneCodingDirs("templates", {
    cwd,
    ...(opts?.home ? { home: opts.home } : {}),
  }).filter((hit) => hit.segment !== "*" && !hit.errors?.length);

  const seen = new Set<string>();
  const out: TemplateInfo[] = [];
  for (const root of roots) {
    for (const { name, templateDir } of scanTemplatesOfRoot(root, base)) {
      if (seen.has(name)) continue; // 就近优先：已见同名模板（更近层）不再取
      seen.add(name);
      out.push({
        name,
        base,
        dir: templateDir,
        layer: root.layer,
        schema: readTemplateSchema(templateDir),
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
};
