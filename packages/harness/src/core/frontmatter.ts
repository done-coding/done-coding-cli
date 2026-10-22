import fs from "node:fs";

/**
 * 取 frontmatter 单行字段值（行级正则，对齐原 governance-lists.py 的 `FM`）。
 * ---
 * 刻意不用 YAML 解析器：清单须与既有生成器逐字节一致，
 * 而 YAML 会把 `modules: [a, b]` 解析成数组、改写引号，输出随之漂移。
 * 值去首尾空白后再去首尾双引号；字段缺失返回 `defaultValue`。
 */
export const readField = (
  content: string,
  key: string,
  defaultValue = "",
): string => {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim().replace(/^"+|"+$/g, "") : defaultValue;
};

/** 只取文件头 `---` 包裹的 frontmatter 块（无则空串），用于正文里可能出现同名字段的文件 */
export const extractFrontmatter = (content: string): string =>
  content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";

/** 读文件后取字段（非 utf-8 字节按替换字符处理，不抛） */
export const readFileField = (
  file: string,
  key: string,
  defaultValue = "",
): string => readField(fs.readFileSync(file, "utf-8"), key, defaultValue);

/** 解析 `modules: [a, b]` 为领域集合（空 / 缺失 → 空集合） */
export const parseModules = (raw: string): Set<string> =>
  new Set(
    raw
      .replace(/^[[\]]+|[[\]]+$/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
