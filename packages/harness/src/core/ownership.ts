import fs from "node:fs";
import path from "node:path";
import { readKnownDomains, type DomainsSource } from "./check";
import { compareCodePoint } from "./fs-entries";
import { createMatcher, invalidPattern } from "./glob";
import { codeSpans, findColumn, parseTables } from "./md-table";

/** 领域状态（harness-workspace §一ⓔ） */
export enum DomainStatusEnum {
  ACTIVE = "active",
  NOT_IMPLEMENTED = "not_implemented",
  RETIRED = "retired",
}

/** 领域表的列名（按表头精确匹配，不看列序） */
export const PATHS_COLUMN = ["paths"];
export const PUBLIC_COLUMN = ["public"];
export const STATUS_COLUMN = ["status"];
/** 共享骨架表：首列表头固定为此 */
export const SKELETON_HEADER = "共享骨架";

/** public 条目的使用方：只对哪类引用方开放（不写 = 对所有跨归属引用方开放） */
export enum PublicAudienceEnum {
  /** 只对共享骨架（装配、服务根测试等）开放 */
  SKELETON = "skeleton",
  /** 只对测试文件开放 */
  TEST = "test",
}

export const PUBLIC_AUDIENCE_LABEL: Record<PublicAudienceEnum, string> = {
  [PublicAudienceEnum.SKELETON]: "共享骨架",
  [PublicAudienceEnum.TEST]: "测试",
};

/** public 条目前缀 → 使用方（写在反引号内，如 `` `骨架:src/app/x/assembly.py` ``） */
const AUDIENCE_PREFIX: Record<string, PublicAudienceEnum> = {
  骨架: PublicAudienceEnum.SKELETON,
  skeleton: PublicAudienceEnum.SKELETON,
  测试: PublicAudienceEnum.TEST,
  test: PublicAudienceEnum.TEST,
};

/** 一条 public：路径模式 + 可选使用方 */
export interface PublicEntry {
  pattern: string;
  audience?: PublicAudienceEnum;
}

/** 拆出 public 条目的使用方前缀；不是已知前缀的整串当路径模式（旧写法不变） */
export const parsePublicEntry = (spec: string): PublicEntry => {
  const m = spec.match(/^([^:/]+):(.+)$/);
  const audience = m ? AUDIENCE_PREFIX[m[1].trim()] : undefined;
  return audience ? { pattern: m![2].trim(), audience } : { pattern: spec };
};

/** 引用方：归属种类 + 是否测试文件 */
export interface Referrer {
  kind: Owner["kind"];
  isTest: boolean;
}

/**
 * 目标是否在 public 内、对这个引用方是否开放：
 * yes = 开放；no = 不在 public；其余 = 在 public 但只对该使用方开放。
 */
export type PublicCheck = (
  file: string,
  referrer: Referrer,
) => "yes" | "no" | PublicAudienceEnum;

const opensTo = (audience: PublicAudienceEnum, referrer: Referrer): boolean =>
  audience === PublicAudienceEnum.SKELETON
    ? referrer.kind === "skeleton"
    : referrer.isTest;

/** public 条目 → 判定函数（非法模式由调用方先滤掉） */
export const createPublicCheck = (entries: PublicEntry[]): PublicCheck => {
  const rules = entries.map((entry) => ({
    ...entry,
    match: createMatcher([entry.pattern]),
  }));
  return (file, referrer) => {
    const hits = rules.filter((rule) => rule.match(file));
    if (!hits.length) return "no";
    const open = hits.find(
      (rule) => !rule.audience || opensTo(rule.audience, referrer),
    );
    return open ? "yes" : hits[0].audience!;
  };
};

/** 领域表里带 paths 的一行 */
export interface DomainRow {
  name: string;
  /** status 列原文；无该列为 undefined（按 active 对待） */
  status?: string;
  paths: string[];
  /** public 列的模式；无该列为 undefined */
  public?: string[];
  line: number;
}

/** 共享骨架表的一行 */
export interface SkeletonRow {
  label: string;
  paths: string[];
  /** public 列的模式；无该列为 undefined（领域 → 壳不设限） */
  public?: string[];
  line: number;
}

/** 从 MODULES.md 读出的归属数据 */
export interface OwnershipModel {
  /** 领域表来源文件（治理目录相对） */
  file: string;
  /** 含 paths 列的领域表行 */
  domains: DomainRow[];
  /** 领域表有无 paths 列（无 = 归属闸缺数据） */
  hasPaths: boolean;
  /** 领域表有无 public 列（无 = 引用闸缺数据） */
  hasPublic: boolean;
  /** 共享骨架表；未建为 undefined（归属闸缺数据） */
  skeleton?: { rows: SkeletonRow[]; hasPublic: boolean; line: number };
  /** 领域表首列登记的全部领域名（与元闸同源） */
  known: Set<string>;
}

const DOMAIN_CELL = /^`([\p{L}\p{N}_-]+)`$/u;

/** 取领域表来源的有效文本与起始行偏移（section 与元闸同规则） */
const scopedText = (
  text: string,
  section?: string,
): { text: string; offset: number } => {
  if (!section) return { text, offset: 0 };
  const at = text.indexOf(section);
  if (at < 0) return { text: "", offset: 0 };
  const after = text.slice(at + section.length);
  return {
    text: after.split("\n## ")[0],
    offset: text.slice(0, at + section.length).split("\n").length - 1,
  };
};

/** 读领域表 paths / public / status 与共享骨架表 */
export const readOwnershipModel = (
  governanceRoot: string,
  source: DomainsSource,
): OwnershipModel => {
  const file = path.join(governanceRoot, source.file);
  const full = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  const scoped = scopedText(full, source.section);
  const model: OwnershipModel = {
    file: source.file,
    domains: [],
    hasPaths: false,
    hasPublic: false,
    known: readKnownDomains(governanceRoot, source),
  };
  for (const table of parseTables(scoped.text, scoped.offset)) {
    const pathsAt = findColumn(table.header, PATHS_COLUMN);
    if (pathsAt < 0) continue;
    const publicAt = findColumn(table.header, PUBLIC_COLUMN);
    const statusAt = findColumn(table.header, STATUS_COLUMN);
    let isDomainTable = false;
    for (const { cells, line } of table.rows) {
      const name = cells[0].match(DOMAIN_CELL)?.[1];
      if (!name) continue;
      isDomainTable = true;
      model.domains.push({
        name,
        status: statusAt < 0 ? undefined : cells[statusAt],
        paths: codeSpans(cells[pathsAt]),
        public: publicAt < 0 ? undefined : codeSpans(cells[publicAt]),
        line,
      });
    }
    if (isDomainTable) {
      model.hasPaths = true;
      model.hasPublic ||= publicAt >= 0;
    }
  }
  const skeleton = parseTables(full).find(
    (table) => table.header[0]?.replace(/`/g, "").trim() === SKELETON_HEADER,
  );
  if (skeleton) {
    const pathsAt = findColumn(skeleton.header, PATHS_COLUMN);
    const publicAt = findColumn(skeleton.header, PUBLIC_COLUMN);
    model.skeleton = {
      line: skeleton.line,
      hasPublic: publicAt >= 0,
      rows: skeleton.rows.map(({ cells, line }) => ({
        label: cells[0],
        paths: pathsAt < 0 ? [] : codeSpans(cells[pathsAt]),
        public: publicAt < 0 ? undefined : codeSpans(cells[publicAt]),
        line,
      })),
    };
  }
  return model;
};

/** 文件归属 */
export type Owner =
  | { kind: "domain"; name: string }
  | { kind: "skeleton"; label: string; row: number };

/** 归属闸配置（`.done-coding/harness/governance/config.json` 的 `ownership`） */
export interface OwnershipConfig {
  /** 不算业务代码的跟踪文件（生成物、vendor 等），仓根相对模式 */
  exclude?: string[];
  /** 算作代码的扩展名（不带点），给出即整体替换缺省清单 */
  extensions?: string[];
}

/** 缺省按扩展名认定代码文件；文档、配置数据、锁文件、图片等不在内 */
export const DEFAULT_CODE_EXTENSIONS = [
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "py",
  "pyi",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "dart",
  "rb",
  "php",
  "sh",
  "sql",
];

/** 未实现领域路径下允许的说明 / 占位文件 */
const isPlaceholder = (file: string): boolean =>
  /\.md$/i.test(file) ||
  [".gitkeep", ".keep"].includes(path.posix.basename(file));

export interface OwnershipResult {
  /** 代码文件 → 归属（无主 / 重叠的文件不在内） */
  owners: Map<string, Owner>;
  /** 应有归属的代码文件（已去掉 exclude） */
  codeFiles: string[];
  /** 无主的代码文件 */
  unowned: string[];
  errors: string[];
  /** 领域名 → 目标是否在该领域 public 内、对引用方是否开放 */
  domainPublic: Map<string, PublicCheck>;
  /** 骨架行序 → 同上；该表无 public 列为 undefined（不设限） */
  skeletonPublic: (PublicCheck | undefined)[];
}

/** 列表过长时截断，完整清单交给 `dc-harness owners --unowned` */
const LIST_LIMIT = 20;
const capped = (items: string[]): string[] =>
  items.length > LIST_LIMIT
    ? [
        ...items.slice(0, LIST_LIMIT),
        `……另 ${items.length - LIST_LIMIT} 个（dc-harness owners --unowned 列全部）`,
      ]
    : items;

const statusOf = (row: DomainRow): string | undefined => {
  if (row.status === undefined) return DomainStatusEnum.ACTIVE;
  const token = row.status.match(/^[a-z_]+/)?.[0];
  return Object.values<string>(DomainStatusEnum).includes(token ?? "")
    ? token
    : undefined;
};

/** public 条目校验：拆前缀后校验模式，非法的报错并剔除 */
const publicFilter =
  (errors: string[]) =>
  (specs: string[], label: string): PublicEntry[] =>
    specs.map(parsePublicEntry).filter(({ pattern }) => {
      const reason = invalidPattern(pattern);
      if (reason) errors.push(`归属：${label} 的模式 \`${pattern}\` ${reason}`);
      return !reason;
    });

/** 模式校验：非法的报错并剔除 */
const patternFilter =
  (errors: string[]) =>
  (patterns: string[], label: string): string[] =>
    patterns.filter((pattern) => {
      const reason = invalidPattern(pattern);
      if (reason) errors.push(`归属：${label} 的模式 \`${pattern}\` ${reason}`);
      return !reason;
    });

/** 领域表 / 骨架表行 → 匹配规则，顺带报表格本身的问题 */
const prepareRules = (model: OwnershipModel, errors: string[]) => {
  const where = (line: number) => `${model.file}:${line}`;
  const valid = patternFilter(errors);
  const validPublic = publicFilter(errors);
  const domainRows = new Set(model.domains.map((row) => row.name));
  for (const name of [...model.known].sort(compareCodePoint)) {
    if (!domainRows.has(name)) {
      errors.push(`归属：领域 \`${name}\` 不在含 paths 列的领域表中`);
    }
  }
  const domains = model.domains.map((row) => {
    const status = statusOf(row);
    if (!status) {
      errors.push(
        `归属：领域 \`${row.name}\`（${where(row.line)}）的 status「${row.status}」不合法，须以 active / not_implemented / retired 开头`,
      );
    }
    if (!row.paths.length) {
      errors.push(`归属：领域 \`${row.name}\`（${where(row.line)}）未写 paths`);
    }
    return {
      row,
      status,
      match: createMatcher(valid(row.paths, `领域 \`${row.name}\``)),
      isPublic: createPublicCheck(
        validPublic(row.public ?? [], `领域 \`${row.name}\` public`),
      ),
    };
  });
  const skeletonRows = (model.skeleton?.rows ?? []).map((row, index) => {
    if (!row.paths.length) {
      errors.push(
        `归属：共享骨架「${row.label}」（${where(row.line)}）未写 paths`,
      );
    }
    return {
      row,
      index,
      match: createMatcher(valid(row.paths, `共享骨架「${row.label}」`)),
      isPublic:
        row.public === undefined
          ? undefined
          : // 骨架行 public 一向不校验模式（存量配置不因此新出报错）
            createPublicCheck(row.public.map(parsePublicEntry)),
    };
  });
  return { domains, skeletonRows };
};

type Rules = ReturnType<typeof prepareRules>;

/** 逐个跟踪文件判归属（领域优先，再落骨架） */
const classify = (
  tracked: string[],
  { domains, skeletonRows }: Rules,
  isCode: (file: string) => boolean,
) => {
  const owners = new Map<string, Owner>();
  const codeFiles: string[] = [];
  const unowned: string[] = [];
  const overlaps: string[] = [];
  const pending: string[] = [];
  for (const file of tracked) {
    const domainHits = domains.filter((d) => d.match(file));
    for (const d of domainHits) {
      if (
        d.status === DomainStatusEnum.NOT_IMPLEMENTED &&
        !isPlaceholder(file)
      ) {
        pending.push(`${file}（\`${d.row.name}\`）`);
      }
    }
    if (!isCode(file)) continue;
    codeFiles.push(file);
    const skeletonHits = domainHits.length
      ? []
      : skeletonRows.filter((s) => s.match(file));
    const hits = domainHits.length ? domainHits : skeletonHits;
    if (hits.length > 1) {
      overlaps.push(
        domainHits.length
          ? `${file} 同属领域 ${domainHits.map((d) => `\`${d.row.name}\``).join("、")}`
          : `${file} 同属共享骨架 ${skeletonHits.map((s) => `「${s.row.label}」`).join("、")}`,
      );
    } else if (domainHits.length) {
      owners.set(file, { kind: "domain", name: domainHits[0].row.name });
    } else if (skeletonHits.length) {
      const { row, index } = skeletonHits[0];
      owners.set(file, { kind: "skeleton", label: row.label, row: index });
    } else unowned.push(file);
  }
  return { owners, codeFiles, unowned, overlaps, pending };
};

/** active 领域须有代码；非未实现领域的 public 须命中本领域代码文件 */
const checkDomainFiles = (
  { domains }: Rules,
  owners: Map<string, Owner>,
): string[] => {
  const errors: string[] = [];
  const ownedBy = (name: string) =>
    [...owners]
      .filter(([, owner]) => owner.kind === "domain" && owner.name === name)
      .map(([file]) => file);
  for (const d of domains) {
    const files = ownedBy(d.row.name);
    if (d.status === DomainStatusEnum.ACTIVE && !files.length) {
      errors.push(
        `归属：active 领域 \`${d.row.name}\` 没有任何代码文件（未实现应标 not_implemented）`,
      );
    }
    if (d.status === DomainStatusEnum.NOT_IMPLEMENTED) continue;
    for (const { pattern } of (d.row.public ?? []).map(parsePublicEntry)) {
      const hit = createMatcher([pattern]);
      if (!files.some(hit)) {
        errors.push(
          `归属：领域 \`${d.row.name}\` 的 public \`${pattern}\` 没有命中本领域的代码文件`,
        );
      }
    }
  }
  return errors;
};

/**
 * 归属闸：每份跟踪的代码文件（含测试）恰属一个领域，或不属领域时恰属一个共享骨架件。
 * ---
 * - 领域优先：骨架按容器登记（如整个应用目录），容器内落在领域 paths 的文件归领域。
 * - 领域之间重叠、骨架件之间重叠、两者都不中（无主）即违规。
 * - not_implemented 领域路径下只许说明与占位（`*.md`、`.gitkeep`、`.keep`）。
 * - active 领域须至少有一份代码文件；public 模式须命中本领域文件。
 */
export const computeOwnership = (
  model: OwnershipModel,
  tracked: string[],
  config: OwnershipConfig = {},
): OwnershipResult => {
  const errors: string[] = [];
  const rules = prepareRules(model, errors);
  const extensions = new Set(
    (config.extensions ?? DEFAULT_CODE_EXTENSIONS).map((ext) =>
      ext.replace(/^\./, "").toLowerCase(),
    ),
  );
  const excluded = createMatcher(
    patternFilter(errors)(config.exclude ?? [], "ownership.exclude"),
  );
  const isCode = (file: string) =>
    extensions.has(path.posix.extname(file).slice(1).toLowerCase()) &&
    !excluded(file);
  const { owners, codeFiles, unowned, overlaps, pending } = classify(
    tracked,
    rules,
    isCode,
  );
  for (const line of capped(overlaps)) errors.push(`归属：重叠 ${line}`);
  for (const line of capped(unowned)) {
    errors.push(`归属：无主 ${line}（不在任何领域 paths 或共享骨架表中）`);
  }
  for (const line of capped(pending)) {
    errors.push(`归属：未实现领域路径下只许说明与占位，发现 ${line}`);
  }
  errors.push(...checkDomainFiles(rules, owners));
  return {
    owners,
    codeFiles,
    unowned,
    errors,
    domainPublic: new Map(rules.domains.map((d) => [d.row.name, d.isPublic])),
    skeletonPublic: rules.skeletonRows.map(({ isPublic }) => isPublic),
  };
};
