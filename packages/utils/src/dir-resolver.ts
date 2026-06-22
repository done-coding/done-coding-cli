import path from "node:path";
import fs from "node:fs";
import { homedir } from "node:os";
import { safeCwd } from "@/safe-cwd";
import { buildAncestorDirList } from "@/look-for";

/**
 * done-coding 层级目录解析底座（设计 §5.1 / §4.1 / §8，纳入 codex M6/M7）。
 * ---
 * 语义：对一个 segment（批次类型名，如 `component`），按
 *   `<cwd>/.done-coding/<segment>/` → 逐级父目录 → 全局 `~/.done-coding/<segment>/`
 * 的**就近优先**顺序解析。
 *
 * - `resolveDoneCodingDir`：单 segment 就近解析，命中即停，**整体覆盖**（非字段合并），未命中 undefined。
 * - `listDoneCodingDirs`：列各层全部可达命中（**并集**），标注 layer / shadowed / shadowedBy，
 *   错误聚合（部分非法不中断整体，errors 挂在各 hit 上）。
 *
 * 软链（M7）：用 `fs.realpathSync` 解析 `realDir`。本模块**只**负责解析 + realpath + 标注；
 * [MUST NOT] 在此做 output 越界判断（产物写入边界由调用方校验）；模板读取边界
 * （input ∈ real templateDir）亦由调用方据 `realDir` 校验。
 */

export type DoneCodingDirLayer = "project" | "parent" | "global";

/** 单条命中（M6 富 API） */
export interface DoneCodingDirHit {
  /** 批次类型名 */
  segment: string;
  /** 命中目录（软链原样路径，未解析） */
  dir: string;
  /** 所属 `.done-coding` 目录 */
  namespaceDir: string;
  /** `fs.realpathSync(dir)`（软链解析后，M7 读边界用） */
  realDir: string;
  /** 所在层级 */
  layer: DoneCodingDirLayer;
  /** 是否被更近层同名 segment 遮蔽（list 用；单 resolve 命中恒为 false） */
  shadowed: boolean;
  /** 遮蔽它的就近命中（仅 list-all 标注） */
  shadowedBy?: DoneCodingDirHit;
  /** 该命中的非法信息（如缺 index.json / realpath 失败等），聚合用 */
  errors?: string[];
}

export interface DoneCodingDirResolverOptions {
  /** 起始目录，默认 `safeCwd()` */
  cwd?: string;
  /** 命名空间目录名，默认 `.done-coding` */
  namespace?: string;
  /**
   * 全局层 HOME 目录，默认 `os.homedir()`。
   * 抽成选项主要给测试用 fake HOME，避免污染真实 `~/.done-coding`。
   */
  home?: string;
}

const DEFAULT_NAMESPACE = ".done-coding";

/**
 * 候选层：从 cwd 链（由近及远）+ 全局 HOME 层，产出 `{ namespaceDir, layer }`。
 * ---
 * 复用 `buildAncestorDirList`（look-for.ts 抽出的祖先链原语）拿 cwd→根的目录链，
 * 反转为「由近及远」后逐目录映射为 `<dir>/<namespace>`：
 *   - 链首（== cwd）→ layer `project`
 *   - 其余父目录 → layer `parent`
 * 末尾追加全局层 `<home>/<namespace>` → layer `global`。
 */
const collectCandidateNamespaces = (
  cwd: string,
  namespace: string,
  home: string,
): Array<{ namespaceDir: string; layer: DoneCodingDirLayer }> => {
  // buildAncestorDirList 由远及近；reverse 得由近及远（cwd 在前）
  const nearToFar = buildAncestorDirList(cwd).reverse();
  const candidates = nearToFar.map((dir, index) => ({
    namespaceDir: path.join(dir, namespace),
    layer: (index === 0 ? "project" : "parent") as DoneCodingDirLayer,
  }));

  const globalNamespaceDir = path.join(home, namespace);
  // 全局层若与某个 cwd 链层重合（HOME 本身在链上），避免重复候选；以 cwd 链层为准。
  const alreadyCovered = candidates.some(
    (c) => path.resolve(c.namespaceDir) === path.resolve(globalNamespaceDir),
  );
  if (!alreadyCovered) {
    candidates.push({ namespaceDir: globalNamespaceDir, layer: "global" });
  }

  return candidates;
};

/** 把一个候选 namespaceDir 下的某 segment 目录构造为 hit（含 realpath / errors）。 */
const buildHit = (
  segment: string,
  namespaceDir: string,
  layer: DoneCodingDirLayer,
): DoneCodingDirHit | undefined => {
  const dir = path.join(namespaceDir, segment);
  // 用 lstat（不跟随软链）判路径项本身是否存在：
  // 悬空软链以「链本身存在」算命中，须产出带 errors 的 hit 而非吞掉（M6 错误聚合，§5.1/R2）。
  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(dir);
  } catch {
    // 路径项本身不存在（非悬空软链，是真缺）→ 非命中
    return undefined;
  }

  const errors: string[] = [];

  // 必须是目录而非文件。软链经 statSync 跟随判定目标类型；悬空软链 statSync 抛错 → 记 error，下方 realpath 兜底。
  let isDir = false;
  if (lstat.isSymbolicLink()) {
    try {
      isDir = fs.statSync(dir).isDirectory();
    } catch (e) {
      errors.push(`无法读取目录状态：${dir}（${(e as Error).message}）`);
    }
  } else {
    isDir = lstat.isDirectory();
  }
  if (!isDir && errors.length === 0) {
    errors.push(`命中路径不是目录：${dir}`);
  }

  // 软链解析（M7）：realpath 失败（如悬空软链）记为 error，realDir 回落 dir
  let realDir = dir;
  try {
    realDir = fs.realpathSync(dir);
  } catch (e) {
    errors.push(`软链解析失败：${dir}（${(e as Error).message}）`);
  }

  return {
    segment,
    dir,
    namespaceDir,
    realDir,
    layer,
    shadowed: false,
    ...(errors.length ? { errors } : {}),
  };
};

/**
 * 单 segment 就近优先解析（cwd → 逐级父 → 全局），命中即停。
 * ---
 * - 命中目录须存在；返回该层 hit（whole-override，非字段合并）。
 * - 全程未命中 → 返回 undefined。
 * - 命中目录本身非法（如缺 realpath / 非目录）仍返回 hit 并挂 errors，由调用方决定是否 fail。
 */
export const resolveDoneCodingDir = (
  segment: string,
  opts: DoneCodingDirResolverOptions = {},
): DoneCodingDirHit | undefined => {
  const cwd = opts.cwd ?? safeCwd();
  const namespace = opts.namespace ?? DEFAULT_NAMESPACE;
  const home = opts.home ?? homedir();

  const candidates = collectCandidateNamespaces(cwd, namespace, home);
  for (const { namespaceDir, layer } of candidates) {
    const hit = buildHit(segment, namespaceDir, layer);
    if (hit) {
      return hit;
    }
  }
  return undefined;
};

/**
 * list-all：列出所有层所有可达命中（各层并集），标注 layer + shadowed + 聚合 errors。
 * ---
 * - `segment` 为具体名 → 仅该 segment 的跨层并集；为 `"*"` → 各层下所有一级子目录批次的并集。
 * - 与单 resolve 分开（M6）：list-all **不在首个非法处中断**，逐项聚合 errors 后整体返回。
 * - 遮蔽语义：同一 segment 跨层多命中时，**就近层**为有效命中（shadowed=false），
 *   其余层 shadowed=true 且 shadowedBy 指向就近命中。返回数组按「由近及远」候选顺序。
 */
export const listDoneCodingDirs = (
  segment: string | "*",
  opts: DoneCodingDirResolverOptions = {},
): DoneCodingDirHit[] => {
  const cwd = opts.cwd ?? safeCwd();
  const namespace = opts.namespace ?? DEFAULT_NAMESPACE;
  const home = opts.home ?? homedir();

  const candidates = collectCandidateNamespaces(cwd, namespace, home);
  const hits: DoneCodingDirHit[] = [];

  for (const { namespaceDir, layer } of candidates) {
    if (!fs.existsSync(namespaceDir)) {
      continue;
    }

    // 该层要枚举的 segment 名集合
    let segments: string[];
    if (segment === "*") {
      try {
        segments = fs
          .readdirSync(namespaceDir, { withFileTypes: true })
          // 跳过隐藏目录（§8 R2 隐藏目录）；只取目录与软链（软链 isDirectory 在此为 false，单列出名后由 buildHit realpath 判定）
          .filter(
            (d) =>
              !d.name.startsWith(".") &&
              (d.isDirectory() || d.isSymbolicLink()),
          )
          .map((d) => d.name);
      } catch (e) {
        // 该层无法枚举：作为一条聚合错误挂在一个占位 hit 上，不中断整体
        hits.push({
          segment: "*",
          dir: namespaceDir,
          namespaceDir,
          realDir: namespaceDir,
          layer,
          shadowed: false,
          errors: [
            `无法枚举命名空间目录：${namespaceDir}（${(e as Error).message}）`,
          ],
        });
        continue;
      }
    } else {
      segments = [segment];
    }

    for (const seg of segments) {
      const hit = buildHit(seg, namespaceDir, layer);
      if (hit) {
        hits.push(hit);
      }
    }
  }

  // 遮蔽标注：按 segment 分组，候选顺序「由近及远」，组内首个为有效命中，其余 shadowed
  const firstBySegment = new Map<string, DoneCodingDirHit>();
  for (const hit of hits) {
    if (hit.segment === "*") {
      continue; // 占位错误 hit 不参与遮蔽
    }
    const prior = firstBySegment.get(hit.segment);
    if (!prior) {
      firstBySegment.set(hit.segment, hit);
    } else {
      hit.shadowed = true;
      hit.shadowedBy = prior;
    }
  }

  return hits;
};
