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
 * - 接缝件：只写反引号包裹的仓根相对路径（可用 glob），多个并列；没有接缝件写「无」；
 *   已替换行的接缝件随替换一并消失写「已删」。
 * - 状态：等待 / 已可替换 / 已替换。
 * - 文件标注：接缝件文件里写标注词（见 SEAM_MARKER），建议放在文件头注释，后跟 issue 标识；
 *   一个文件可承载多个接缝（每个接缝一处标注）。
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
/** 已替换行：接缝件随替换一并删掉 */
const SEAM_DELETED = "已删";
/** issue 标识：6 位小写字母数字且含数字（与各仓 issue id 同形） */
const ISSUE_ID = /(?<![a-z0-9])(?=[a-z]*\d)[a-z0-9]{6}(?![a-z0-9])/g;

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

/** 文件里各处标注后面写的 issue 标识（同一行标注词之后） */
export const readSeamIds = (projectRoot: string, file: string): string[] => {
  const text = readTrackedText(projectRoot, file) ?? "";
  return text
    .split("\n")
    .filter((line) => line.includes(SEAM_MARKER))
    .flatMap((line) => [
      ...(line
        .slice(line.indexOf(SEAM_MARKER) + SEAM_MARKER.length)
        .match(ISSUE_ID) ?? []),
    ]);
};

/**
 * 缺口表闸：表的格式、接缝件路径存在、标注与表双向一致。
 * ---
 * - 每行：缺口 / issue 非空；状态取值合法；接缝件为「无」或全是能命中跟踪文件的路径。
 * - 等待 / 已可替换行的接缝件文件须带标注；带标注的文件须出现在等待 / 已可替换行。
 * - 已替换行的路径仍须存在（0041ⓓ 在接缝内替换，接缝件保留）；接缝件随替换消失写「已删」。
 * - 标注带 issue 标识、且该标识只出现在已替换行时，报「标注应去掉」；
 *   同一文件可同时出现在已替换行与等待行（承载先后两个接缝），不因已替换行要求去标注。
 */
export const checkSeams = (gap: GapTable, input: SeamFiles): string[] => {
  const { file, table } = gap;
  if (!table) {
    return [`缺口表：${file} 的「done-coding 缺口表」标题下没有表格`];
  }
  const columns: GapColumns = {
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
  const scan = scanRows({ file, table, columns, tracked: input.tracked });
  return [...scan.errors, ...checkMarks(file, scan, input)];
};

/** 缺口表闸的文件面 */
export interface SeamFiles {
  /** 仓内文件（跟踪 + 未跟踪的新文件） */
  tracked: string[];
  /** 带标注词的文件 */
  annotated: string[];
  /** 文件里标注后写的 issue 标识 */
  idsOf?: (file: string) => string[];
}

interface GapColumns {
  gap: number;
  seam: number;
  issue: number;
  status: number;
}

/** 逐行扫表的结果 */
interface RowScan {
  errors: string[];
  /** 等待 / 已可替换行的接缝件文件 → 行号 */
  openFiles: Map<string, number>;
  /** issue 标识 → 出现的行（状态、行号） */
  idRows: Map<string, { status: string; line: number }[]>;
}

/** 一行的接缝件格：「无」/「已删」/ 反引号路径（须命中文件） */
const checkSeamCell = (
  cell: string,
  row: { where: string; status: string },
  tracked: string[],
): { errors: string[]; hits: string[] } => {
  const { where, status } = row;
  if (cell === NO_SEAM) return { errors: [], hits: [] };
  if (cell === SEAM_DELETED) {
    return {
      errors:
        status === SeamStatusEnum.REPLACED
          ? []
          : [`缺口表：${where} 接缝件写「已删」只用于已替换行`],
      hits: [],
    };
  }
  const patterns = codeSpans(cell);
  if (!patterns.length) {
    return {
      errors: [
        `缺口表：${where} 接缝件须写反引号路径，没有接缝件写「无」，随替换删掉写「已删」`,
      ],
      hits: [],
    };
  }
  const errors: string[] = [];
  const hits: string[] = [];
  for (const pattern of patterns) {
    const reason = invalidPattern(pattern);
    if (reason) {
      errors.push(`缺口表：${where} 接缝件 \`${pattern}\` ${reason}`);
      continue;
    }
    const match = createMatcher([pattern]);
    const found = tracked.filter((f) => match(f));
    if (!found.length) {
      errors.push(
        `缺口表：${where} 接缝件 \`${pattern}\` 不存在（未命中跟踪文件）`,
      );
    }
    hits.push(...found);
  }
  return { errors, hits };
};

/** 逐行核对：缺口 / issue 非空、状态合法、接缝件格；收集未结行的接缝件与 issue 标识 */
const scanRows = ({
  file,
  table,
  columns,
  tracked,
}: {
  file: string;
  table: MarkdownTable;
  columns: GapColumns;
  tracked: string[];
}): RowScan => {
  const scan: RowScan = { errors: [], openFiles: new Map(), idRows: new Map() };
  for (const { cells, line } of table.rows) {
    const where = `${file}:${line}`;
    if (!cells[columns.gap]) scan.errors.push(`缺口表：${where} 缺口为空`);
    if (!cells[columns.issue]) scan.errors.push(`缺口表：${where} issue 为空`);
    const status = cells[columns.status];
    if (!Object.values<string>(SeamStatusEnum).includes(status)) {
      scan.errors.push(
        `缺口表：${where} 状态「${status}」不合法（${Object.values(SeamStatusEnum).join(" / ")}）`,
      );
    }
    for (const id of cells[columns.issue].match(ISSUE_ID) ?? []) {
      scan.idRows.set(id, [...(scan.idRows.get(id) ?? []), { status, line }]);
    }
    const cell = checkSeamCell(cells[columns.seam], { where, status }, tracked);
    scan.errors.push(...cell.errors);
    if (OPEN_STATUSES.includes(status)) {
      for (const hit of cell.hits) scan.openFiles.set(hit, line);
    }
  }
  return scan;
};

/** 标注与表双向核对；标注的 issue 标识只对上已替换行时，这处标注应去掉 */
const checkMarks = (
  file: string,
  { openFiles, idRows }: RowScan,
  { annotated, idsOf = () => [] }: SeamFiles,
): string[] => {
  const errors: string[] = [];
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
      continue;
    }
    for (const id of new Set(idsOf(seam))) {
      const rows = idRows.get(id) ?? [];
      if (
        rows.length &&
        rows.every((r) => r.status === SeamStatusEnum.REPLACED)
      ) {
        errors.push(
          `缺口表：${seam} 的标注 ${id} 对应的行（${rows.map((r) => `${file}:${r.line}`).join("、")}）已替换，这处标注应去掉`,
        );
      }
    }
  }
  return errors;
};
