import fs from "node:fs";
import path from "node:path";

/**
 * 按 Unicode code point 比较字符串（对齐 Python 默认字符串排序）。
 * JS 默认 sort 按 UTF-16 code unit，遇代理对时与 Python 不一致。
 */
export const compareCodePoint = (a: string, b: string): number => {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const len = Math.min(ca.length, cb.length);
  for (let i = 0; i < len; i++) {
    const diff = ca[i].codePointAt(0)! - cb[i].codePointAt(0)!;
    if (diff !== 0) return diff;
  }
  return ca.length - cb.length;
};

/** 按 code point 截前 n 个字符（对齐 Python `s[:n]`） */
export const takeCodePoints = (s: string, n: number): string =>
  Array.from(s).slice(0, n).join("");

/** 目录下的条目名（code point 升序）；目录不存在返回空数组 */
export const listDirSorted = (dir: string): string[] =>
  fs.existsSync(dir) && fs.statSync(dir).isDirectory()
    ? fs.readdirSync(dir).sort(compareCodePoint)
    : [];

/** 目录下的子目录名（升序） */
export const listSubdirs = (dir: string): string[] =>
  listDirSorted(dir).filter((name) =>
    fs.statSync(path.join(dir, name)).isDirectory(),
  );

/** 目录下的 `.md` 文件名（升序） */
export const listMarkdown = (dir: string): string[] =>
  listDirSorted(dir).filter((name) => name.endsWith(".md"));

/** 批次目录下的条目文件名（`.md` 且非 `PROGRESS.md`） */
export const listItems = (dir: string): string[] =>
  listMarkdown(dir).filter((name) => name !== PROGRESS_FILE);

/** 批次进度文件名 */
export const PROGRESS_FILE = "PROGRESS.md";
