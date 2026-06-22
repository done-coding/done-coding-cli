/**
 * INSERT 模式的语言感知 marker 哨兵注释工具（P2，design §2/§3/§12）。
 *
 * 纯字符串运算（无 fs IO，便于单测）：注释样式表 + marker 构建/校验 +
 * EOL 检测 + 正向插入计算 + 回退删除计算。
 * 对标 Ansible blockinfile：回退只认两条 marker 行，免疫块内手改（R8①）。
 *
 * codex 交叉审纳入（design §12）：
 *  - A4/E12 防伪造：写入前校验 block 不含 marker 行。
 *  - A4/E13 唯一成对：同 markerKey 块数 ∈ {0,1}成对，否则 fail-loud（取代"首个 indexOf"）。
 *  - A5/E14 markerKey 校验：非空/单行/无 open·close 冲突/无 dc-gen: 前缀。
 *  - A6/E10·E11·E15 anchor 校验：空 pattern / 非法 regex（包装）/ 枚举。
 *  - A7 EOL：检测主导 EOL，插入行用同一 EOL，避免混合。
 */
import path from "node:path";
import type { InsertAnchor, InsertMarkerComment } from "@/types";

/** 默认 marker namespace（仅供显式引用，[MUST NOT] 作隐式兜底，见 design R-B4） */
export const DEFAULT_MARKER_NS = "dc-gen";

/** 行注释构造（close 空） */
const lineComment = (
  exts: string[],
  open: string,
): Record<string, InsertMarkerComment> =>
  Object.fromEntries(exts.map((ext) => [ext, { open, close: "" }]));

/** 块注释构造 */
const blockComment = (
  exts: string[],
  open: string,
  close: string,
): Record<string, InsertMarkerComment> =>
  Object.fromEntries(exts.map((ext) => [ext, { open, close }]));

/**
 * 扩展名 → 注释样式表（design §2.1，C 系用行注释 `//`，用户设计闸已放行）。
 */
const COMMENT_TABLE: Record<string, InsertMarkerComment> = {
  // C 系行注释
  ...lineComment(
    [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".go",
      ".java",
      ".c",
      ".h",
      ".cpp",
      ".rs",
      ".kt",
      ".swift",
      ".scala",
    ],
    "//",
  ),
  // 仅块注释语言
  ...blockComment([".css", ".less", ".scss", ".sass"], "/*", "*/"),
  // 标记语言
  ...blockComment(
    [".vue", ".html", ".htm", ".xml", ".svg", ".md", ".markdown"],
    "<!--",
    "-->",
  ),
  // 井号系
  ...lineComment(
    [
      ".py",
      ".sh",
      ".bash",
      ".zsh",
      ".yaml",
      ".yml",
      ".toml",
      ".rb",
      ".ini",
      ".conf",
    ],
    "#",
  ),
};

/**
 * 解析语言感知注释样式（§2/§2.2）。override 优先；否则按扩展名查表；
 * 未命中且无 override → fail-loud（E7）。
 */
export const resolveMarkerComment = (
  outputPath: string,
  override?: InsertMarkerComment,
): InsertMarkerComment => {
  if (override) {
    return override;
  }
  const ext = path.extname(outputPath).toLowerCase();
  const found = COMMENT_TABLE[ext];
  if (!found) {
    throw new Error(
      `inject 目标 ${outputPath} 扩展名「${ext || "(无)"}」无内建注释样式，请在 FileEntry.markerComment 显式声明 { open, close }`,
    );
  }
  return found;
};

/** 构建 start/end marker 两行（写入与回退查找处统一产出，保逐字符一致，design §12 P2） */
export const buildMarkerLines = (
  comment: InsertMarkerComment,
  markerKey: string,
  markerNs: string,
): { startLine: string; endLine: string } => {
  const { open, close } = comment;
  const wrap = (body: string): string =>
    `${open} === ${markerNs}:${body}:${markerKey} === ${close}`.trimEnd();
  return { startLine: wrap("start"), endLine: wrap("end") };
};

/** 是否含控制字符（含 \r/\n/\t/NUL，charCodeAt<0x20）——避免控制字符正则 */
const hasControlChar = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) {
      return true;
    }
  }
  return false;
};

/**
 * 校验渲染后的 markerKey（A5/E14）：
 * 非空、单行（无换行/控制字符）、不含注释 open·close 冲突子串、不含 ns: 前缀。
 */
export const validateMarkerKey = (
  markerKey: string | undefined,
  comment: InsertMarkerComment,
  outputPath: string,
  markerNs: string,
  // eslint-disable-next-line max-params
): string => {
  if (!markerKey) {
    throw new Error(`inject 目标 ${outputPath} 的 markerKey 渲染后为空`);
  }
  if (hasControlChar(markerKey)) {
    throw new Error(
      `inject 目标 ${outputPath} 的 markerKey 含换行/控制字符，须为单行：${JSON.stringify(markerKey)}`,
    );
  }
  if (markerKey.includes(comment.open)) {
    throw new Error(
      `inject markerKey 含注释起始符「${comment.open}」会破坏哨兵：${markerKey}`,
    );
  }
  if (comment.close && markerKey.includes(comment.close)) {
    throw new Error(
      `inject markerKey 含注释结束符「${comment.close}」会破坏哨兵：${markerKey}`,
    );
  }
  if (markerKey.includes(`${markerNs}:`)) {
    throw new Error(
      `inject markerKey [MUST NOT] 含保留前缀「${markerNs}:」（防伪造哨兵）：${markerKey}`,
    );
  }
  return markerKey;
};

/** 校验 anchor（A6/E10·E11·E15）；返回行匹配函数 */
const compileAnchor = (
  anchor: InsertAnchor,
  outputPath: string,
): ((line: string) => boolean) => {
  const { pattern, position, patternType = "literal" } = anchor;
  if (position !== "before" && position !== "after") {
    throw new Error(
      `inject 目标 ${outputPath} 的 anchor.position 非法「${String(position)}」（须 before|after）`,
    );
  }
  if (patternType !== "literal" && patternType !== "regex") {
    throw new Error(
      `inject 目标 ${outputPath} 的 anchor.patternType 非法「${String(patternType)}」（须 literal|regex）`,
    );
  }
  if (!pattern) {
    throw new Error(
      `inject 目标 ${outputPath} 的 anchor.pattern 渲染后为空（literal 空串匹配首行、regex 空串近乎处处匹配，已拒绝）`,
    );
  }
  if (patternType === "regex") {
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch (error) {
      throw new Error(
        `inject 目标 ${outputPath} 的 anchor.pattern 不是合法正则「${pattern}」：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return (line: string): boolean => re.test(line);
  }
  return (line: string): boolean => line.includes(pattern);
};

/** 检测主导 EOL（A7）：含 \r\n 即 CRLF，否则 LF */
export const detectEol = (content: string): "\r\n" | "\n" =>
  content.includes("\r\n") ? "\r\n" : "\n";

/** 按换行切行（清除行尾 \r，回写时统一用 detectEol 的 EOL 重拼） */
const splitLines = (content: string): string[] => content.split(/\r?\n/);

/** 把渲染后的 block 内容切为纯行（丢弃单个尾随空行——marker 即边界，尾换行为噪声，design §6） */
const blockToLines = (rendered: string): string[] => {
  const lines = splitLines(rendered);
  if (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
};

/** 统计精确等于某行的出现次数 */
const countExact = (lines: string[], target: string): number =>
  lines.reduce((n, line) => (line === target ? n + 1 : n), 0);

/**
 * 校验同 markerKey 块在文件内的存在形态（A4/E13）：
 * 返回 0（全新）或 1（成对存在）；其余（>1、不成对、end 在 start 前）→ fail-loud。
 */
const assertMarkerPairing = (
  lines: string[],
  marker: { startLine: string; endLine: string },
  outputPath: string,
): 0 | 1 => {
  const { startLine, endLine } = marker;
  const startCount = countExact(lines, startLine);
  const endCount = countExact(lines, endLine);
  if (startCount === 0 && endCount === 0) {
    return 0;
  }
  if (startCount === 1 && endCount === 1) {
    const s = lines.indexOf(startLine);
    const e = lines.indexOf(endLine);
    if (e < s) {
      throw new Error(
        `inject 目标 ${outputPath} 的 marker end 早于 start（块损坏），请手动清理`,
      );
    }
    return 1;
  }
  throw new Error(
    `inject 目标 ${outputPath} 同 markerKey 块非唯一成对（start×${startCount}/end×${endCount}），请手动清理后重试`,
  );
};

/**
 * 正向插入计算（A4/A7）。
 *  - block 防伪造（E12）：渲染内容不得含 marker 行。
 *  - 已存在成对块（=1）→ 原位替换块内容（幂等，E8）；否则按 anchor 插入（E1 未命中 throw）。
 * 返回新文件内容（caller 负责写 fs）。
 */
export const computeInsert = (
  oldContent: string,
  rendered: string,
  opts: {
    comment: InsertMarkerComment;
    markerKey: string;
    markerNs: string;
    anchor?: InsertAnchor;
    outputPath: string;
    onNotice?: (msg: string) => void;
  },
): string => {
  const { comment, markerKey, markerNs, anchor, outputPath, onNotice } = opts;
  const { startLine, endLine } = buildMarkerLines(comment, markerKey, markerNs);

  const blockLines = blockToLines(rendered);
  if (blockLines.some((line) => line === startLine || line === endLine)) {
    throw new Error(
      `inject 目标 ${outputPath} 的渲染内容含与 marker 相同的行（疑似伪造哨兵），已拒绝`,
    );
  }
  const block = [startLine, ...blockLines, endLine];

  const eol = detectEol(oldContent);
  const lines = splitLines(oldContent);
  const pairing = assertMarkerPairing(
    lines,
    { startLine, endLine },
    outputPath,
  );

  if (pairing === 1) {
    // 幂等：原位替换 [start..end] 区间（E8）
    const s = lines.indexOf(startLine);
    const e = lines.indexOf(endLine);
    lines.splice(s, e - s + 1, ...block);
    onNotice?.(`inject 已存在同 markerKey 块，原位替换内容：${outputPath}`);
    return lines.join(eol);
  }

  // 全新插入：按 anchor 定位（E1/E2）
  if (!anchor) {
    throw new Error(
      `inject 目标 ${outputPath} 缺 anchor（inject 须提供锚点定位）`,
    );
  }
  const match = compileAnchor(anchor, outputPath);
  const matched: number[] = [];
  lines.forEach((line, i) => {
    if (match(line)) {
      matched.push(i);
    }
  });
  if (matched.length === 0) {
    throw new Error(
      `inject 锚点未命中：文件 ${outputPath}，pattern「${anchor.pattern}」(${anchor.patternType ?? "literal"})`,
    );
  }
  if (matched.length > 1) {
    onNotice?.(
      `inject 锚点多处匹配（${matched.length}），取首个：${outputPath} pattern「${anchor.pattern}」`,
    );
  }
  const anchorIdx = matched[0];
  const insertAt = anchor.position === "before" ? anchorIdx : anchorIdx + 1;
  lines.splice(insertAt, 0, ...block);
  return lines.join(eol);
};

/**
 * 回退删除计算（A1/A4）。只认两条 marker 行，免疫块内手改（R8①）。
 * 返回新内容（删除块后）；caller 负责空文件删除决策。marker 未命中 → fail-loud（E4）。
 */
export const computeRollback = (
  oldContent: string,
  opts: {
    comment: InsertMarkerComment;
    markerKey: string;
    markerNs: string;
    outputPath: string;
  },
): string => {
  const { comment, markerKey, markerNs, outputPath } = opts;
  const { startLine, endLine } = buildMarkerLines(comment, markerKey, markerNs);
  const eol = detectEol(oldContent);
  const lines = splitLines(oldContent);

  const startCount = countExact(lines, startLine);
  const endCount = countExact(lines, endLine);
  if (startCount === 0 || endCount === 0) {
    throw new Error(
      `inject 回退未命中 marker（可能已被手删）：${outputPath} markerKey「${markerKey}」。请手动确认。`,
    );
  }
  // 复用唯一成对校验（E13）
  assertMarkerPairing(lines, { startLine, endLine }, outputPath);
  const s = lines.indexOf(startLine);
  const e = lines.indexOf(endLine);
  lines.splice(s, e - s + 1);
  return lines.join(eol);
};

/**
 * 三态探测：该 markerKey 在文件内的块状态。
 *  0 = 完全缺失（可在 skip-missing 下跳过）；
 *  1 = 唯一成对存在（可安全修改）；
 *  throw = 损坏（>1、不成对、end-before-start）→ 即使 skip-missing 也 fail-loud。
 *
 * 供 modify 预检（design §1.3 / R-D4）。不读 fs（content 由 caller 传入）。
 */
export const probeMarkerPairing = (
  content: string,
  opts: {
    comment: InsertMarkerComment;
    markerKey: string;
    markerNs: string;
    outputPath: string;
  },
): 0 | 1 => {
  const { comment, markerKey, markerNs, outputPath } = opts;
  const { startLine, endLine } = buildMarkerLines(comment, markerKey, markerNs);
  const lines = splitLines(content);
  return assertMarkerPairing(lines, { startLine, endLine }, outputPath);
};
