/** Markdown 表格（治理文档里机器读的那一份）的最小解析 */
export interface MarkdownTable {
  /** 表头单元格（已去首尾空白） */
  header: string[];
  /** 数据行（与表头等长，缺格补空串） */
  rows: { cells: string[]; line: number }[];
  /** 表头所在行号（1 起） */
  line: number;
}

/** 按 `|` 切单元格：跳过 `\|` 与反引号内的竖线 */
const splitRow = (line: string): string[] => {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let inCode = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "`") {
      inCode = !inCode;
      current += ch;
    } else if (ch === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
    } else current += ch;
  }
  cells.push(current.trim());
  return cells;
};

const SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** 取文本中的全部表格（表头行 + 分隔行 + 连续的 `|` 行） */
export const parseTables = (text: string, lineOffset = 0): MarkdownTable[] => {
  const lines = text.split(/\r?\n/);
  const tables: MarkdownTable[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].trim().startsWith("|") || !SEPARATOR.test(lines[i + 1])) {
      continue;
    }
    const header = splitRow(lines[i]);
    const rows: MarkdownTable["rows"] = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().startsWith("|"); j++) {
      const cells = splitRow(lines[j]);
      rows.push({
        cells: header.map((_, k) => cells[k] ?? ""),
        line: lineOffset + j + 1,
      });
    }
    tables.push({ header, rows, line: lineOffset + i + 1 });
    i = j - 1;
  }
  return tables;
};

/** 表头单元格规范化：去反引号与首尾空白、小写 */
const normalizeHeader = (cell: string): string =>
  cell.replace(/`/g, "").trim().toLowerCase();

/** 按列名找列（精确匹配任一候选名，不区分大小写）；无则 -1 */
export const findColumn = (header: string[], names: string[]): number => {
  const wanted = names.map((name) => name.toLowerCase());
  return header.findIndex((cell) => wanted.includes(normalizeHeader(cell)));
};

/** 取单元格内全部反引号片段 */
export const codeSpans = (cell: string): string[] =>
  [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
