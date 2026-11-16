import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compareCodePoint } from "./fs-entries";
import { createMatcher } from "./glob";
import { readScope } from "./scope";

/**
 * 能力目录：done-coding 已发布包 + 注册表里本机仓的包，按所在仓分系列。
 * ---
 * 一律现取，不存静态清单：
 * - npm：官方源按维护者检索（维护者取自本包自身的 maintainers），只收 repository 在
 *   `github.com/<组织>/` 下的包；逐包读 latest 清单（依赖、目录、弃用说明）。
 * - 本机：注册表（`dc-harness scope`）登记的仓，按工作区声明读 package.json，
 *   另读 `packages/` 下的 pyproject.toml——未上公共源的包（如 done-creating）从这里来。
 * 系列 = 包所在仓；概述取注册表定位，否则取与系列同名的聚合包描述。
 */

/** 默认官方源（done-coding 包的 publishConfig 即此源；镜像可能滞后） */
export const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";

export interface CatalogPackage {
  name: string;
  ecosystem: "npm" | "python";
  /** 描述（缺失为空串） */
  description: string;
  /** npm 上的 latest；未发布 / 未比对为 undefined */
  version?: string;
  /** 本机仓里的版本 */
  localVersion?: string;
  /** 最近发布时间（npm） */
  published?: string;
  /** npm 弃用说明 */
  deprecated?: string;
  /** 发布到的非官方源（publishConfig.registry） */
  registry?: string;
  /** package.json 标了 private */
  private?: boolean;
  /** 同系列中把本包列为 dependencies 的包 */
  dependents: string[];
  /** 本包 dependencies 里的同系列包（≥ 2 即聚合入口） */
  bundles: string[];
  /** 包含本包的聚合入口（同系列中 bundles ≥ 2 且含本包者） */
  includedIn: string[];
  /** 本包 peerDependencies 里的同系列包（须搭配安装） */
  peers: string[];
  /** 文档：本机 README 或 npm 页面 */
  docs: string;
}

export interface CatalogSeries {
  /** 仓名 */
  name: string;
  overview?: string;
  overviewSource?: "registry" | "aggregate";
  /** GitHub 组织（来自 npm repository；仅本机来源时为 undefined） */
  org?: string;
  /** 本机仓根（注册表登记时有） */
  repoPath?: string;
  packages: CatalogPackage[];
}

export interface Catalog {
  series: CatalogSeries[];
  /** npm 比对状态 */
  npm: {
    state: "ok" | "offline" | "skipped";
    registry: string;
    error?: string;
    /** 检索到但读清单失败的包 */
    failures: string[];
  };
}

export type Fetcher = (url: string) => Promise<any>;

/** 默认取数：全局 fetch + 超时，网络错误退避重试三次；非 2xx 抛错 */
export const defaultFetcher: Fetcher = async (url) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt)
      await new Promise((resolve) => {
        setTimeout(resolve, 500 * attempt);
      });
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
      return await response.json();
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith("HTTP ")) break;
    }
  }
  const cause = (lastError as { cause?: { code?: string } })?.cause?.code;
  throw new Error(
    `${lastError instanceof Error ? lastError.message : String(lastError)}${cause ? `（${cause}）` : ""}：${url}`,
  );
};

const repoNameOf = (url?: string): string | undefined =>
  url
    ?.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?]|$)/)
    ?.slice(1)
    .join("/");

/** 并发上限内依次执行 */
const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

interface NpmEntry {
  pkg: CatalogPackage;
  /** `组织/仓名` */
  repo: string;
  dependencies: string[];
  peerDependencies: string[];
}

/** npm 源：按维护者检索、按组织过滤、逐包读 latest */
const readNpm = async ({
  registry,
  selfName,
  fetcher,
  failures,
}: {
  registry: string;
  selfName: string;
  fetcher: Fetcher;
  /** 读清单失败的包（收集后继续，不让单包失败拖垮整源） */
  failures: string[];
}): Promise<NpmEntry[]> => {
  const encode = (name: string) => name.replace("/", "%2f");
  const self = await fetcher(`${registry}/${encode(selfName)}/latest`);
  const org = repoNameOf(self.repository?.url)?.split("/")[0];
  const maintainers: string[] = (self.maintainers ?? [])
    .map((m: any) => (typeof m === "string" ? m.split(" ")[0] : m?.name))
    .filter(Boolean);
  if (!org || !maintainers.length) {
    throw new Error(`${selfName} 的清单缺 repository 或 maintainers`);
  }
  const names = new Map<string, string | undefined>();
  for (const maintainer of maintainers) {
    for (let from = 0; ; from += 250) {
      const page = await fetcher(
        `${registry}/-/v1/search?text=${encodeURIComponent(`maintainer:${maintainer}`)}&size=250&from=${from}`,
      );
      for (const { package: p } of page.objects ?? []) {
        names.set(p.name, p.date);
      }
      if (!page.objects?.length || from + 250 >= page.total) break;
    }
  }
  const entries = await mapLimit([...names], 8, async ([name, date]) => {
    let manifest: any;
    try {
      manifest = await fetcher(`${registry}/${encode(name)}/latest`);
    } catch (err) {
      failures.push(
        `${name}（${err instanceof Error ? err.message : String(err)}）`,
      );
      return undefined;
    }
    const repo = repoNameOf(manifest.repository?.url ?? manifest.repository);
    if (!repo || repo.split("/")[0] !== org) return undefined;
    const entry: NpmEntry = {
      repo,
      dependencies: Object.keys(manifest.dependencies ?? {}),
      peerDependencies: Object.keys(manifest.peerDependencies ?? {}),
      pkg: {
        name,
        ecosystem: "npm",
        description: manifest.description ?? "",
        version: manifest.version,
        published: date,
        deprecated: manifest.deprecated || undefined,
        dependents: [],
        bundles: [],
        includedIn: [],
        peers: [],
        docs: `https://www.npmjs.com/package/${name}`,
      },
    };
    return entry;
  });
  return entries.filter((e): e is NpmEntry => Boolean(e));
};

interface LocalEntry extends NpmEntry {
  repoPath: string;
}

/** 工作区声明的包目录模式：pnpm-workspace.yaml 优先，否则 package.json workspaces */
const workspaceGlobs = (repoPath: string): string[] => {
  const yaml = path.join(repoPath, "pnpm-workspace.yaml");
  if (fs.existsSync(yaml)) {
    const block =
      fs.readFileSync(yaml, "utf-8").split(/^packages:\s*$/m)[1] ?? "";
    return [...block.matchAll(/^\s*-\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/gm)]
      .map((m) => m[1])
      .filter((glob) => !glob.startsWith("!"));
  }
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoPath, "package.json"), "utf-8"),
    );
    const ws = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : pkg.workspaces?.packages;
    return (ws ?? []).filter((glob: string) => !glob.startsWith("!"));
  } catch {
    return [];
  }
};

const tomlField = (text: string, key: string): string | undefined =>
  text.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"))?.[1];

/** 本机 README（没有就指向清单文件本身） */
const docsOf = (abs: string): string => {
  const readme = path.join(path.dirname(abs), "README.md");
  return fs.existsSync(readme) ? readme : abs;
};

/** 工作区里非 private 或带 publishConfig 的 npm 包；其余返回 undefined */
const readLocalNpm = (abs: string): Omit<NpmEntry, "repo"> | undefined => {
  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch {
    return undefined;
  }
  if (!pkg.name || (pkg.private && !pkg.publishConfig)) return undefined;
  const registry: string | undefined = pkg.publishConfig?.registry;
  return {
    dependencies: Object.keys(pkg.dependencies ?? {}),
    peerDependencies: Object.keys(pkg.peerDependencies ?? {}),
    pkg: {
      name: pkg.name,
      ecosystem: "npm",
      description: pkg.description ?? "",
      localVersion: pkg.version,
      private: pkg.private || undefined,
      registry:
        registry && !registry.startsWith(DEFAULT_NPM_REGISTRY)
          ? registry
          : undefined,
      dependents: [],
      bundles: [],
      includedIn: [],
      peers: [],
      docs: docsOf(abs),
    },
  };
};

/** `packages/` 下名字合法的 Python 包（模板里的占位名如 `${name}` 不算） */
const readLocalPython = (abs: string): Omit<NpmEntry, "repo"> | undefined => {
  const text = fs.readFileSync(abs, "utf-8");
  const name = tomlField(text, "name");
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return undefined;
  return {
    dependencies: [],
    peerDependencies: [],
    pkg: {
      name,
      ecosystem: "python",
      description: tomlField(text, "description") ?? "",
      localVersion: tomlField(text, "version"),
      dependents: [],
      bundles: [],
      includedIn: [],
      peers: [],
      docs: docsOf(abs),
    },
  };
};

/** 仓里跟踪的 package.json / pyproject.toml */
const trackedManifests = (repoPath: string): string[] => {
  try {
    return execFileSync(
      "git",
      ["ls-files", "-z", "--", "*package.json", "*pyproject.toml"],
      { cwd: repoPath, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
    )
      .split("\0")
      .filter(Boolean);
  } catch {
    return [];
  }
};

/** 注册表里本机仓的包（工作区里非 private 或带 publishConfig 的 npm 包 + packages/ 下的 Python 包） */
const readLocal = (scopeDir?: string): LocalEntry[] => {
  const entries: LocalEntry[] = [];
  for (const { entry } of readScope(scopeDir)) {
    const repoPath = entry.path;
    if (!repoPath || !fs.existsSync(path.join(repoPath, ".git"))) continue;
    // 本机仓以注册表登记名为系列名（与 npm repository 的仓名对齐）
    const repo = entry.name || path.basename(repoPath);
    const inWorkspace = createMatcher(
      workspaceGlobs(repoPath).map(
        (glob) => `${glob.replace(/\/+$/, "")}/package.json`,
      ),
    );
    for (const file of trackedManifests(repoPath)) {
      const abs = path.join(repoPath, file);
      const read = file.endsWith("package.json")
        ? file !== "package.json" &&
          inWorkspace(file) &&
          !file.includes("node_modules/") &&
          readLocalNpm(abs)
        : file.split("/").slice(0, -1).includes("packages") &&
          readLocalPython(abs);
      if (read) entries.push({ ...read, repo, repoPath });
    }
  }
  return entries;
};

/** 系列内的聚合 / 包含 / 搭配关系（只看同系列包） */
const linkSeries = (
  series: CatalogSeries,
  entryOf: Map<string, NpmEntry>,
): void => {
  const names = new Set(series.packages.map((p) => p.name));
  const inSeries = (list: string[] = []) =>
    list.filter((d) => names.has(d)).sort(compareCodePoint);
  const byName = new Map(series.packages.map((p) => [p.name, p]));
  for (const pkg of series.packages) {
    const entry = entryOf.get(pkg.name);
    pkg.bundles = inSeries(entry?.dependencies);
    pkg.peers = inSeries(entry?.peerDependencies);
    for (const dep of pkg.bundles) byName.get(dep)!.dependents.push(pkg.name);
  }
  for (const pkg of series.packages) {
    pkg.dependents.sort(compareCodePoint);
    pkg.includedIn = pkg.dependents.filter(
      (d) => byName.get(d)!.bundles.length >= 2,
    );
  }
  series.packages.sort((a, b) => compareCodePoint(a.name, b.name));
};

/** 系列概述：注册表定位优先，否则取与系列同名的聚合包描述 */
const describeSeries = (series: CatalogSeries, registered?: string): void => {
  // 仓名去掉组织前缀（acme/acme-ui → ui）后匹配 `@*/ui` 或全名
  const short =
    series.org && series.name.startsWith(`${series.org}-`)
      ? series.name.slice(series.org.length + 1)
      : series.name;
  const aggregate = series.packages.find(
    (p) => p.name.endsWith(`/${short}`) || p.name === series.name,
  );
  if (registered) {
    series.overview = registered;
    series.overviewSource = "registry";
  } else if (aggregate?.description) {
    series.overview = aggregate.description;
    series.overviewSource = "aggregate";
  }
};

export interface BuildCatalogOptions {
  /** 本包名（取维护者与组织） */
  selfName: string;
  registry?: string;
  offline?: boolean;
  fetcher?: Fetcher;
  /** 注册表目录（测试用） */
  scopeDir?: string;
}

/** 汇总两路数据为系列目录 */
export const buildCatalog = async (
  options: BuildCatalogOptions,
): Promise<Catalog> => {
  const registry = (options.registry ?? DEFAULT_NPM_REGISTRY).replace(
    /\/+$/,
    "",
  );
  const npm: Catalog["npm"] = { state: "skipped", registry, failures: [] };
  let npmEntries: NpmEntry[] = [];
  if (!options.offline) {
    try {
      npmEntries = await readNpm({
        registry,
        selfName: options.selfName,
        fetcher: options.fetcher ?? defaultFetcher,
        failures: npm.failures,
      });
      npm.state = "ok";
    } catch (err) {
      npm.state = "offline";
      npm.error = err instanceof Error ? err.message : String(err);
    }
  }
  const local = readLocal(options.scopeDir);
  const positioning = new Map(
    readScope(options.scopeDir).map(({ entry }) => [
      entry.name,
      entry.positioning,
    ]),
  );

  // 按包名合并：npm 给发布事实，本机给本机版本与 README
  const merged = new Map<string, { entry: NpmEntry; repoPath?: string }>();
  for (const entry of npmEntries) merged.set(entry.pkg.name, { entry });
  for (const entry of local) {
    const hit = merged.get(entry.pkg.name);
    if (hit) {
      hit.entry.pkg.localVersion = entry.pkg.localVersion;
      hit.entry.pkg.docs = entry.pkg.docs;
      hit.repoPath = entry.repoPath;
    } else merged.set(entry.pkg.name, { entry, repoPath: entry.repoPath });
  }

  const bySeries = new Map<string, CatalogSeries>();
  for (const { entry, repoPath } of merged.values()) {
    const [org, repoName] = entry.repo.includes("/")
      ? entry.repo.split("/")
      : [undefined, entry.repo];
    const name = repoName;
    const series = bySeries.get(name) ?? { name, org, packages: [] };
    series.org ??= org;
    series.repoPath ??= repoPath;
    series.packages.push(entry.pkg);
    bySeries.set(name, series);
  }
  const entryOf = new Map(
    [...merged.values()].map(({ entry }) => [entry.pkg.name, entry]),
  );
  for (const series of bySeries.values()) {
    linkSeries(series, entryOf);
    describeSeries(series, positioning.get(series.name));
  }
  return {
    series: [...bySeries.values()].sort((a, b) =>
      compareCodePoint(a.name, b.name),
    ),
    npm,
  };
};

const semverParts = (v?: string): number[] =>
  (v ?? "")
    .replace(/[-+].*$/, "")
    .split(".")
    .map((n) => Number(n) || 0);
const semverLess = (a?: string, b?: string): boolean => {
  const [x, y] = [semverParts(a), semverParts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
};

/** 目录过期 / 缺数据检查：本机版本落后 npm、缺描述、系列缺概述、npm 未比对 */
export const checkCatalog = (catalog: Catalog): string[] => {
  const problems: string[] = [];
  if (catalog.npm.state !== "ok") {
    problems.push(
      `npm 未比对（${catalog.npm.state === "offline" ? `取数失败：${catalog.npm.error}` : "--offline"}），已发布版本与本机克隆无法核对`,
    );
  }
  for (const failure of catalog.npm.failures) {
    problems.push(`npm 清单读取失败：${failure}`);
  }
  for (const series of catalog.series) {
    if (!series.overview) {
      problems.push(
        `系列 ${series.name} 缺概述：仓未登记仓库注册表，也没有同名聚合包（dc-harness scope register 登记定位）`,
      );
    }
    for (const pkg of series.packages) {
      if (!pkg.description) problems.push(`${pkg.name} 缺 description`);
      if (
        pkg.version &&
        pkg.localVersion &&
        semverLess(pkg.localVersion, pkg.version)
      ) {
        problems.push(
          `${pkg.name} 本机 ${pkg.localVersion} 落后 npm ${pkg.version}（${series.repoPath ?? series.name} 先 git pull）`,
        );
      }
    }
  }
  return problems;
};

/** 目录里出现过的 npm 作用域 + 本包作用域（npm 未比对时 --installed 用来补列） */
export const catalogScopes = (catalog: Catalog, selfName: string): string[] =>
  [
    ...new Set(
      [
        selfName,
        ...catalog.series.flatMap((s) => s.packages.map((p) => p.name)),
      ]
        .filter((name) => name.startsWith("@"))
        .map((name) => name.split("/")[0]),
    ),
  ].sort(compareCodePoint);

export interface InstalledRow {
  name: string;
  series: string;
  /** package.json 声明的范围 */
  declared?: string;
  /** node_modules 里实际装的版本 */
  installed?: string;
  latest?: string;
}

/** 当前项目装了目录里的哪些包，同系列版本是否一致 */
export const inspectInstalled = (
  projectRoot: string,
  catalog: Catalog,
  /** npm 未比对时按这些 npm 作用域补列项目依赖（取自本包名与本机仓包名，不写死） */
  fallbackScopes: string[] = [],
): { rows: InstalledRow[]; warnings: string[] } => {
  const pkgFile = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgFile))
    throw new Error(`当前目录没有 package.json：${projectRoot}`);
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
  const declared: Record<string, string> = {
    ...pkg.peerDependencies,
    ...pkg.devDependencies,
    ...pkg.dependencies,
  };
  const rows: InstalledRow[] = [];
  for (const series of catalog.series) {
    for (const p of series.packages) {
      const installedFile = path.join(
        projectRoot,
        "node_modules",
        p.name,
        "package.json",
      );
      const installed = fs.existsSync(installedFile)
        ? JSON.parse(fs.readFileSync(installedFile, "utf-8")).version
        : undefined;
      if (!declared[p.name] && !installed) continue;
      rows.push({
        name: p.name,
        series: series.name,
        declared: declared[p.name],
        installed,
        latest: p.version,
      });
    }
  }
  const warnings: string[] = [];
  if (catalog.npm.state !== "ok") {
    const known = new Set(rows.map((r) => r.name));
    const extra = Object.keys(declared)
      .filter(
        (name) =>
          !known.has(name) &&
          fallbackScopes.some((scope) => name.startsWith(`${scope}/`)),
      )
      .sort(compareCodePoint);
    for (const name of extra) {
      const file = path.join(projectRoot, "node_modules", name, "package.json");
      const meta = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, "utf-8"))
        : {};
      const repo = repoNameOf(meta.repository?.url ?? meta.repository);
      rows.push({
        name,
        series: repo?.split("/").pop() ?? "（系列未知）",
        declared: declared[name],
        installed: meta.version,
      });
    }
    warnings.push(
      `npm 未比对：目录外的依赖按作用域 ${fallbackScopes.join("、") || "（无）"} 补列，最新版本与同系列版本一致性未核对`,
    );
  }
  const bySeries = new Map<string, InstalledRow[]>();
  rows.forEach((r) =>
    bySeries.set(r.series, [...(bySeries.get(r.series) ?? []), r]),
  );
  for (const [series, list] of bySeries) {
    // 只对同版本发布的系列（目录里各包版本一致，如 forge）要求一致；独立定版的系列（如 cli）不报
    const members =
      catalog.series.find((s) => s.name === series)?.packages ?? [];
    const lockstep =
      members.length > 1 &&
      new Set(members.map((m) => m.version ?? m.localVersion)).size === 1;
    const versions = new Set(list.map((r) => r.installed ?? r.declared));
    if (lockstep && versions.size > 1) {
      warnings.push(
        `系列 ${series} 各包同版本发布，当前项目装的版本不一致：${list.map((r) => `${r.name}@${r.installed ?? r.declared}`).join("、")}`,
      );
    }
  }
  return { rows, warnings };
};
