/**
 * 冲突格式化 + 聚合断言（design §3.2 / **§14 D-L4**，fail-loud 一等公民）。
 *
 *  - formatConflict：指名 recipeId/file/locator/两侧 {opId,source}，可读 fail-loud 文案。
 *  - assertNoConflicts：非空则 throw 聚合文案（原子中止）。
 */
import type { Conflict, ConflictSide } from "./types";

const formatSide = (side: ConflictSide): string => {
  const op = side.opId ? `op=${side.opId}` : "op=?";
  const src = side.source ? ` source=${side.source}` : "";
  return `${op}${src}`;
};

/** 单条冲突格式化为可读 fail-loud 文案（含 provenance 两侧）。 */
export const formatConflict = (c: Conflict): string => {
  const head = `[冲突] recipe=${c.recipeId} file=${c.file || "(待填)"}`;
  const loc = c.locator ? ` locator=${c.locator}` : "";
  const sides =
    c.sides.length > 0
      ? `\n    两侧来源：${c.sides.map(formatSide).join("  ↔  ")}`
      : "";
  return `${head}${loc}\n    ${c.message}${sides}`;
};

/** 冲突列表非空则 throw 聚合文案（原子中止，A3④）。 */
export const assertNoConflicts = (conflicts: Conflict[]): void => {
  if (conflicts.length === 0) return;
  const body = conflicts.map(formatConflict).join("\n");
  throw new Error(
    `assemble 检测到 ${conflicts.length} 处冲突（fail-loud，原子中止）：\n${body}`,
  );
};
