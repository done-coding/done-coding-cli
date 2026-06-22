/**
 * <批次发现 + 层级解析消费>（design §4.1，R2 + L5，K9）。
 *
 *  - 消费 cli-utils dir-resolver（resolveDoneCodingDir / listDoneCodingDirs）。
 *  - R2 边界：仅扫一层 / 隐藏目录跳过（resolver 已做）/ index.json 校验 / 软链 realDir /
 *    大小写冲突 fail / 路径合法性 / 错误聚合。
 *  - 读 index.json.config → json5.parse(config.json5) 得 BatchConfig。
 *  - 实例永远落地 execDir=safeCwd（与模板层无关，L5；由命令面注入）。
 */
import fs from "node:fs";
import path from "node:path";
import type {
  BatchConfig,
  DiscoveredBatchListItem,
  ResolvedBatch,
} from "@/types";
import {
  json5,
  listDoneCodingDirs,
  resolveDoneCodingDir,
  type DoneCodingDirHit,
} from "@done-coding/cli-utils";

/** index.json 形态（最小契约）：指向 config.json5 的相对路径 */
interface BatchIndexJson {
  config: string;
}

/** realpath 容错（路径不存在时回落 resolve 后字面量，越界校验用前缀比较即可） */
const safeRealpath = (p: string): string => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

/** 路径 child 是否在 parent 内（含等于 parent 自身） */
const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/**
 * 读取并解析批次 config（index.json.config → json5.parse(config.json5)）。
 * @param batchDir 批次模板目录（建议传 realDir，软链解析后）
 */
export const readBatchConfig = (batchDir: string): BatchConfig => {
  const indexPath = path.join(batchDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `批次目录缺少 index.json，视为非法批次：${batchDir}（需直含 index.json，仅扫一层，R2）`,
    );
  }

  let indexJson: BatchIndexJson;
  try {
    indexJson = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `index.json 解析失败：${indexPath}（${
        error instanceof Error ? error.message : String(error)
      }）`,
    );
  }

  if (!indexJson || typeof indexJson.config !== "string") {
    throw new Error(
      `index.json 缺少 config 字段（指向 config.json5）：${indexPath}`,
    );
  }

  const configPath = path.resolve(batchDir, indexJson.config);

  // H3：config 路径越界校验——index.json.config 须落在 batchDir 内（含 realpath，
  // 防绝对路径 / `../` 逃出批次目录读任意文件）。realBatchDir/realConfig 均经 realpath。
  const realBatchDir = safeRealpath(batchDir);
  const realConfigPath = safeRealpath(configPath);
  if (!isInside(realBatchDir, realConfigPath)) {
    throw new Error(
      `index.json.config 越界（须落在批次目录内）：${indexJson.config} → ${realConfigPath}（batchDir=${realBatchDir}）`,
    );
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `批次 config 文件不存在：${configPath}（index.json.config 指向）`,
    );
  }

  let config: BatchConfig;
  try {
    config = json5.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `批次 config（json5）解析失败：${configPath}（${
        error instanceof Error ? error.message : String(error)
      }）`,
    );
  }

  if (!config || typeof config.instanceDir !== "string") {
    throw new Error(`批次 config 缺少必填字段 instanceDir：${configPath}`);
  }
  if (!Array.isArray(config.files)) {
    throw new Error(`批次 config 缺少必填字段 files（数组）：${configPath}`);
  }

  return config;
};

/**
 * 单 type 就近优先解析 + 读 config（cwd→逐级父→全局，就近即停）。
 * 未命中 / 命中目录非法（缺 index.json 等）→ fail-fast。
 */
export const discoverBatch = (
  type: string,
  opts?: { cwd?: string },
): ResolvedBatch => {
  const hit = resolveDoneCodingDir(type, { cwd: opts?.cwd });
  if (!hit) {
    throw new Error(
      `未找到批次类型「${type}」：已逐级向上查找 .done-coding/${type}/ 至全局 ~/.done-coding/${type}/，均未命中（R2）`,
    );
  }

  // dir-resolver 标注的命中级错误（软链解析失败 / 非目录等）→ fail-fast
  if (hit.errors?.length) {
    throw new Error(
      `批次「${type}」命中目录非法：${hit.dir}\n  - ${hit.errors.join("\n  - ")}`,
    );
  }

  // 软链已由 resolver 解析 realDir；读 config 用 realDir（M7 读边界基准）
  const config = readBatchConfig(hit.realDir);

  // L1：allowSymlinkTemplateDir===false 且批次模板目录是软链 → fail-fast；默认（undefined/true）放行。
  // 软链判定用 hit.dir（未解析原样路径），lstat 不跟随软链。
  if (config.allowSymlinkTemplateDir === false) {
    let isSymlink = false;
    try {
      isSymlink = fs.lstatSync(hit.dir).isSymbolicLink();
    } catch {
      isSymlink = false;
    }
    if (isSymlink) {
      throw new Error(
        `批次「${type}」模板目录为软链，但 config.allowSymlinkTemplateDir=false 禁止：${hit.dir} → ${hit.realDir}`,
      );
    }
  }

  return { type, hit, config };
};

/**
 * 同层同名（仅大小写差异）冲突检测（R2 大小写冲突，区分大小写 FS）。
 * 把同一 namespaceDir 下小写相同的 segment 视为冲突，聚合后 fail。
 */
const ensureNoCaseConflict = (hits: DoneCodingDirHit[]): void => {
  const byNamespaceLower = new Map<string, Map<string, string[]>>();
  for (const hit of hits) {
    if (hit.segment === "*") {
      continue;
    }
    const perNs =
      byNamespaceLower.get(hit.namespaceDir) ?? new Map<string, string[]>();
    const lower = hit.segment.toLowerCase();
    perNs.set(lower, [...(perNs.get(lower) ?? []), hit.segment]);
    byNamespaceLower.set(hit.namespaceDir, perNs);
  }

  const conflicts: string[] = [];
  for (const [namespaceDir, perNs] of byNamespaceLower) {
    for (const [, names] of perNs) {
      if (names.length > 1) {
        conflicts.push(`${namespaceDir}：${names.join(" vs ")}`);
      }
    }
  }
  if (conflicts.length) {
    throw new Error(
      `批次名大小写冲突（同层仅大小写差异，歧义不允许）：\n  - ${conflicts.join(
        "\n  - ",
      )}`,
    );
  }
};

/**
 * 发现 list（dc-gen list [type]）：各层并集，标注 layer + shadowed（K5 发现 DTO）。
 * [MUST NOT] 复用批次实例 list serializer、[MUST NOT] 写 component-name-list.json。
 */
/**
 * 校验单 hit 是否合法批次：可解析 index.json（指向的 config 存在/可解析），
 * 返回错误信息数组（空 = 合法）。不抛错（聚合用）。
 */
const validateHitErrors = (hit: DoneCodingDirHit): string[] => {
  // dir-resolver 已标注的命中级错误（软链失败 / 非目录等）先纳入
  const errors: string[] = [...(hit.errors ?? [])];
  // 用 realDir 判 index.json（M7 读边界基准）
  const indexPath = path.join(hit.realDir, "index.json");
  if (!fs.existsSync(indexPath)) {
    errors.push(`缺少 index.json：${hit.realDir}（仅扫一层，R2）`);
    return errors;
  }
  try {
    readBatchConfig(hit.realDir);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
};

export const listDiscoveredBatches = (
  type: string | "*",
  opts?: { cwd?: string },
): DiscoveredBatchListItem[] => {
  const hits = listDoneCodingDirs(type, { cwd: opts?.cwd });

  // 大小写冲突 fail（R2）；占位错误 hit（segment="*"）不参与
  ensureNoCaseConflict(hits);

  // M1：逐 hit 校验 index.json 可解析；非法项标注 invalid + 聚合 errors（不被当正常批次），
  // 输出 hit.errors（不静默吞）。合法/非法均列出，由命令面渲染时区分。
  return hits
    .filter((hit) => hit.segment !== "*")
    .map((hit) => {
      const errors = validateHitErrors(hit);
      return {
        name: hit.segment,
        source: hit.segment,
        layer: hit.layer,
        shadowed: hit.shadowed,
        ...(errors.length ? { invalid: true, errors } : {}),
      };
    });
};
