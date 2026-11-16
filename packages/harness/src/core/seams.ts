import fs from "node:fs";
import path from "node:path";
import { readTrackedText } from "./git-files";
import { createMatcher, invalidPattern } from "./glob";
import {
  codeSpans,
  findColumn,
  parseTables,
  type MarkdownTable,
} from "./md-table";

/**
 * 缺口表（blueprint 0041ⓔ）的机器读格式：
 * ---
 * - 位置：治理目录 `SNAPSHOT.md` 中标题 `## done-coding 缺口表`（其后可加说明）下的第一张表。
 * - 列：`缺口` · `接缝件` · `issue` · `状态`（按表头名取，可另加 `#`、`备注` 等列）。
 * - 接缝件：只写反引号包裹的仓根相对路径（可用 glob），多个并列；没有接缝件写「无」。
 * - 状态：等待 / 已可替换 / 已替换。
 * - 文件标注：接缝件文件里写标注词（见 SEAM_MARKER），建议放在文件头注释。
 */
export const GAP_TABLE_HEADING = /^##\s+done-coding 缺口表(?=\s|（|\(|$)/;
/** 接缝件文件标注词；拆开拼接，免得本文件自己被扫成接缝件 */
export const SEAM_MARKER = ["@done-coding", "seam"].join("-");

export enum SeamStatusEnum {
  WAITING = "等待",
  REPLACEABLE = "已可替换",
  REPLACED = "已替换",
}

/** 仍是临时实现的状态：其接缝件须带标注 */
const OPEN_STATUSES: string[] = [
  SeamStatusEnum.WAITING,
  SeamStatusEnum.REPLACEABLE,
];
const NO_SEAM = "无";

/** 缺口表定位结果 */
export interface GapTable {
  file: string;
  table?: MarkdownTable;
}

/** 在治理 SNAPSHOT.md 里找缺口表；无标题返回 undefined */
export const readGapTable = (
  governanceRoot: string,
  file = "SNAPSHOT.md",
): GapTable | undefined => {
  const abs = path.join(governanceRoot, file);
  if (!fs.existsSync(abs)) return undefined;
  const lines = fs.readFileSync(abs, "utf-8").split(/\r?\n/);
  const start = lines.findIndex((line) => GAP_TABLE_HEADING.test(line));
  if (start < 0) return undefined;
  let end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  if (end < 0) end = lines.length;
  const section = lines.slice(start + 1, end).join("\n");
  return { file, table: parseTables(section, start + 1)[0] };
};

/** 跟踪文件中带标注词的（不扫 Markdown：文档里会提到标注词本身） */
export const findAnnotated = (
  projectRoot: string,
  tracked: string[],
): string[] =>
  tracked.filter(
    (file) =>
      !/\.(?:md|markdown)$/i.test(file) &&
      readTrackedText(projectRoot, file)?.includes(SEAM_MARKER),
  );

/**
 * 缺口表闸：表的格式、接缝件路径存在、标注与表双向一致。
 * ---
 * - 每行：缺口 / issue 非空；状态取值合法；接缝件为「无」或全是能命中跟踪文件的路径。
 * - 等待 / 已可替换行的接缝件文件须带标注；带标注的文件须出现在等待 / 已可替换行。
 * - 已替换行的路径仍须存在（0041ⓓ 在接缝内替换，接缝件保留），标注应已去掉。
 */
export const checkSeams = (
  gap: GapTable,
  tracked: string[],
  annotated: string[],
): string[] => {
  const errors: string[] = [];
  const { file, table } = gap;
  if (!table) {
    return [`缺口表：${file} 的「done-coding 缺口表」标题下没有表格`];
  }
  const columns = {
    gap: findColumn(table.header, ["缺口"]),
    seam: findColumn(table.header, ["接缝件"]),
    issue: findColumn(table.header, ["issue"]),
    status: findColumn(table.header, ["状态"]),
  };
  const missing = Object.entries({
    缺口: columns.gap,
    接缝件: columns.seam,
    issue: columns.issue,
    状态: columns.status,
  })
    .filter(([, index]) => index < 0)
    .map(([name]) => name);
  if (missing.length) {
    return [
      `缺口表：${file}:${table.line} 缺列 ${missing.join("、")}（表头须含 缺口 / 接缝件 / issue / 状态）`,
    ];
  }
  const openFiles = new Map<string, number>();
  for (const { cells, line } of table.rows) {
    const where = `${file}:${line}`;
    if (!cells[columns.gap]) errors.push(`缺口表：${where} 缺口为空`);
    if (!cells[columns.issue]) errors.push(`缺口表：${where} issue 为空`);
    const status = cells[columns.status];
    if (!Object.values<string>(SeamStatusEnum).includes(status)) {
      errors.push(
        `缺口表：${where} 状态「${status}」不合法（${Object.values(SeamStatusEnum).join(" / ")}）`,
      );
    }
    const seamCell = cells[columns.seam];
    if (seamCell === NO_SEAM) continue;
    const patterns = codeSpans(seamCell);
    if (!patterns.length) {
      errors.push(`缺口表：${where} 接缝件须写反引号路径，没有接缝件写「无」`);
      continue;
    }
    for (const pattern of patterns) {
      const reason = invalidPattern(pattern);
      if (reason) {
        errors.push(`缺口表：${where} 接缝件 \`${pattern}\` ${reason}`);
        continue;
      }
      const match = createMatcher([pattern]);
      const hits = tracked.filter((f) => match(f));
      if (!hits.length) {
        errors.push(
          `缺口表：${where} 接缝件 \`${pattern}\` 不存在（未命中跟踪文件）`,
        );
      }
      if (OPEN_STATUSES.includes(status)) {
        for (const hit of hits) openFiles.set(hit, line);
      }
    }
  }
  const marked = new Set(annotated);
  for (const [seam, line] of openFiles) {
    if (!marked.has(seam)) {
      errors.push(`缺口表：${seam}（${file}:${line}）未带标注 ${SEAM_MARKER}`);
    }
  }
  for (const seam of annotated) {
    if (!openFiles.has(seam)) {
      errors.push(
        `缺口表：${seam} 带标注 ${SEAM_MARKER}，但不在缺口表的等待 / 已可替换行`,
      );
    }
  }
  return errors;
};
