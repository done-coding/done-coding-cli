import fs from "node:fs";
import path from "node:path";
import { parseModules, readFileField } from "./frontmatter";
import {
  compareCodePoint,
  listItems,
  listMarkdown,
  listSubdirs,
  PROGRESS_FILE,
} from "./fs-entries";
import { diffLists, GovernanceDirEnum, readBatchModules } from "./lists";

/** 领域表来源（仓间差异唯一点） */
export interface DomainsSource {
  /** 治理目录内的文件，默认 `MODULES.md` */
  file: string;
  /** 只取该标题到下一个 `## ` 标题之间的内容；缺省取全文 */
  section?: string;
}

/** 默认领域表来源 */
export const DEFAULT_DOMAINS_SOURCE: DomainsSource = { file: "MODULES.md" };

/** 领域表行：首列为反引号包裹的领域名 */
const DOMAIN_ROW = /^\|\s*`([\p{L}\p{N}_-]+)`\s*\|/gmu;

/** 从领域表解析已登记的垂直领域名 */
export const readKnownDomains = (
  root: string,
  source: DomainsSource,
): Set<string> => {
  const file = path.join(root, source.file);
  if (!fs.existsSync(file)) return new Set();
  let text = fs.readFileSync(file, "utf-8");
  if (source.section) {
    const [, after] = text.split(source.section);
    text = after === undefined ? "" : after.split("\n## ")[0];
  }
  return new Set([...text.matchAll(DOMAIN_ROW)].map((m) => m[1]));
};

const sortedList = (set: Iterable<string>): string =>
  `[${[...set]
    .sort(compareCodePoint)
    .map((x) => `'${x}'`)
    .join(", ")}]`;

/** 批次目录名 `<id>-<slug>` → 批次 id */
const batchIdOf = (dir: string): string => dir.split("-")[0];

/** 在途批次 PROGRESS.md 的 `after`（缺 PROGRESS / 未写 → 空串） */
const afterOf = (root: string, batch: string): string => {
  const progress = path.join(
    root,
    GovernanceDirEnum.SCHEDULE,
    batch,
    PROGRESS_FILE,
  );
  return fs.existsSync(progress) ? readFileField(progress, "after") : "";
};

/**
 * 沿 after 回溯在途前驱（遇已归档 / 串首即止）。
 * 回到自身 = 成环（调用方 [MUST NOT] 据环上前驱豁免并行闸）。
 */
const chainAncestors = (
  root: string,
  batches: string[],
  batch: string,
): { ancestors: Set<string>; cyclic: boolean } => {
  const byId = new Map(batches.map((b) => [batchIdOf(b), b]));
  const ancestors = new Set<string>();
  let cur = byId.get(afterOf(root, batch));
  while (cur && !ancestors.has(cur)) {
    if (cur === batch) return { ancestors, cyclic: true };
    ancestors.add(cur);
    cur = byId.get(afterOf(root, cur));
  }
  return { ancestors, cyclic: false };
};

/** 批次串校验：after 悬空 / 分叉 / 成环 */
const checkChains = (root: string, batches: string[]): string[] => {
  const errs: string[] = [];
  const known = new Set(
    [
      ...batches,
      ...listSubdirs(path.join(root, GovernanceDirEnum.ARCHIVE)),
    ].map(batchIdOf),
  );
  const successors = new Map<string, string[]>();
  for (const b of batches) {
    const after = afterOf(root, b);
    if (!after) continue;
    if (!known.has(after)) {
      errs.push(`批次串：schedule/${b} 的 after 指向不存在的批次 ${after}`);
    }
    successors.set(after, [...(successors.get(after) ?? []), b]);
  }
  for (const [after, next] of successors) {
    if (next.length > 1) {
      errs.push(`批次串：${after} 之后分叉为 ${sortedList(next)}`);
    }
  }
  for (const b of batches) {
    if (chainAncestors(root, batches, b).cyclic) {
      errs.push(`批次串：schedule/${b} 的 after 链成环`);
    }
  }
  return errs;
};

/**
 * 治理闸：元闸 + 并行闸 + 收口形态 + 清单零 diff，返回全部违规（空数组 = 全过）。
 * ---
 * - 元闸：backlog/ 与在途批次的条目 [MUST] 有非空 `modules` 且都已登记——缺数据的并行闸只会恒绿。
 * - 批次串：PROGRESS.md 的 `after: <前一批 id>` 串起同窗口多批（批次 id = 目录名 `<id>-<slug>` 前缀）；
 *   after 悬空（schedule / archive 均无）、分叉（两在途批同 after）、成环即违规。
 * - 并行闸：两个在途批次领域集合相交即违规；同一 after 链上（一方是另一方的前驱）豁免。
 * - 收口形态：在途批次须有 PROGRESS.md；archive/ 只许 PROGRESS.md；dropped/ 须有理由；issue/ 须有 from。
 * - 清单：重生成后与在库清单零 diff。
 */
export const runChecks = (
  root: string,
  source: DomainsSource = DEFAULT_DOMAINS_SOURCE,
): string[] => {
  const errs: string[] = [];
  const known = readKnownDomains(root, source);
  if (!known.size) {
    errs.push(`元闸：${source.file} 领域表未解析出任何领域`);
  }

  const scheduleDir = path.join(root, GovernanceDirEnum.SCHEDULE);
  const batches = listSubdirs(scheduleDir);
  const itemFiles = [
    ...listItems(path.join(root, GovernanceDirEnum.BACKLOG)).map((f) =>
      path.join(root, GovernanceDirEnum.BACKLOG, f),
    ),
    ...batches.flatMap((b) =>
      listItems(path.join(scheduleDir, b)).map((f) =>
        path.join(scheduleDir, b, f),
      ),
    ),
  ];
  for (const file of itemFiles) {
    const rel = path.relative(root, file);
    const mods = parseModules(readFileField(file, "modules"));
    const unknown = [...mods].filter((m) => !known.has(m));
    if (!mods.size) errs.push(`元闸：${rel} 缺 modules`);
    else if (unknown.length) {
      errs.push(`元闸：${rel} 含未登记领域 ${sortedList(unknown)}`);
    }
  }

  const batchMods = new Map(
    batches.map((b) => [b, readBatchModules(path.join(scheduleDir, b))]),
  );
  errs.push(...checkChains(root, batches));
  const ancestors = new Map(
    batches.map((b) => {
      const chain = chainAncestors(root, batches, b);
      return [b, chain.cyclic ? new Set<string>() : chain.ancestors];
    }),
  );
  batches.forEach((a, i) => {
    for (const b of batches.slice(i + 1)) {
      const hit = [...batchMods.get(a)!].filter((m) =>
        batchMods.get(b)!.has(m),
      );
      const sameChain = ancestors.get(a)!.has(b) || ancestors.get(b)!.has(a);
      if (hit.length && !sameChain) {
        errs.push(`并行闸：${a} ∩ ${b} = ${sortedList(hit)}`);
      }
    }
  });

  for (const b of batches) {
    if (!fs.existsSync(path.join(scheduleDir, b, PROGRESS_FILE))) {
      errs.push(`收口：schedule/${b} 缺 ${PROGRESS_FILE}`);
    }
  }
  const archiveDir = path.join(root, GovernanceDirEnum.ARCHIVE);
  for (const b of listSubdirs(archiveDir)) {
    const extra = fs
      .readdirSync(path.join(archiveDir, b))
      .filter((f) => f !== PROGRESS_FILE)
      .sort(compareCodePoint);
    if (extra.length) {
      errs.push(
        `收口：archive/${b} 只许 ${PROGRESS_FILE}，多出 ${sortedList(extra)}`,
      );
    }
  }
  const droppedDir = path.join(root, GovernanceDirEnum.DROPPED);
  for (const f of listMarkdown(droppedDir)) {
    const file = path.join(droppedDir, f);
    if (
      !readFileField(file, "dropped") &&
      !readFileField(file, "merged_into")
    ) {
      errs.push(
        `收口：${path.relative(root, file)} 缺 dropped 理由或 merged_into`,
      );
    }
  }
  const issueDir = path.join(root, GovernanceDirEnum.ISSUE);
  for (const f of listMarkdown(issueDir)) {
    const file = path.join(issueDir, f);
    if (!readFileField(file, "from")) {
      errs.push(`收口：${path.relative(root, file)} 缺 from`);
    }
  }

  const drift = diffLists(root);
  if (drift.length) {
    errs.push(
      `清单：已漂移（${drift.join(" · ")}），跑 dc-harness lists 重生成`,
    );
  }
  return errs;
};
