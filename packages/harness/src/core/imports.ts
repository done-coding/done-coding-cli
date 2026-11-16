import path from "node:path";
import { readTrackedText } from "./git-files";
import type { Owner, OwnershipResult } from "./ownership";

/** 引用闸配置（`.done-coding/harness/governance/config.json` 的 `imports`） */
export interface ImportsConfig {
  /** 只查引用方落在这些模式内的引用（过渡期分段启用，如先只查前端）；缺省查全部代码文件 */
  include?: string[];
}

/** 一条静态引用 */
export interface ImportEdge {
  /** 引用方（仓根相对） */
  from: string;
  /** 被引用的跟踪文件（仓根相对） */
  to: string;
  /** 源码里的写法 */
  spec: string;
  line: number;
}

const JS_EXTENSIONS = /\.(?:[cm]?[jt]sx?|vue|svelte)$/;
const PY_EXTENSIONS = /\.pyi?$/;

/** 静态 import / export from / 字面量 import() / require() */
const JS_IMPORT =
  /(?:^|[;\n}])\s*(?:import|export)\s+(?:type\s+)?(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"'\n]+)["']|\bimport\(\s*["']([^"'\n]+)["']\s*\)|\brequire\(\s*["']([^"'\n]+)["']\s*\)/g;
const PY_FROM =
  /^[ \t]*from[ \t]+(\.*[\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n#]+)/gm;
const PY_IMPORT = /^[ \t]*import[ \t]+([\w. \t,]+)/gm;

const lineAt = (text: string, index: number): number =>
  text.slice(0, index).split("\n").length;

/** JSONC（tsconfig）宽松解析：去注释与尾逗号 */
const parseJsonc = (text: string): any => {
  const stripped = text
    .replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) =>
      str ? m : "",
    )
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
};

interface PathAlias {
  /** 别名前缀（去掉 `*`） */
  prefix: string;
  /** 是否带通配 */
  wildcard: boolean;
  /** 目标（仓根相对，`*` 处替换） */
  targets: string[];
}

interface TsResolveConfig {
  aliases: PathAlias[];
  /** baseUrl（仓根相对）；无则 undefined */
  baseUrl?: string;
}

/**
 * 解析器：只把引用落到 git 跟踪文件上；落不到的（第三方包、标准库、动态拼接）跳过。
 * ---
 * - TS / JS / Vue / Svelte：相对路径；最近的 tsconfig.json / jsconfig.json 的 `paths` 与 `baseUrl`（含相对 extends）。
 * - Python：相对导入；绝对导入从引用方所在目录逐级向上（含各级 `src/`）找首段包。
 */
export const createResolver = (projectRoot: string, tracked: string[]) => {
  const files = new Set(tracked);
  const dirs = new Set<string>();
  for (const file of tracked) {
    const parts = file.split("/");
    for (let i = 1; i < parts.length; i++)
      dirs.add(parts.slice(0, i).join("/"));
  }
  const tsConfigCache = new Map<string, TsResolveConfig | undefined>();

  const readTsConfig = (
    file: string,
    seen = new Set<string>(),
  ): TsResolveConfig | undefined => {
    if (seen.has(file)) return undefined;
    seen.add(file);
    const text = readTrackedText(projectRoot, file);
    if (text === undefined) return undefined;
    let json: any;
    try {
      json = parseJsonc(text);
    } catch {
      return undefined;
    }
    const dir = path.posix.dirname(file);
    const parentRel =
      typeof json.extends === "string" && json.extends.startsWith(".")
        ? path.posix.normalize(path.posix.join(dir, json.extends))
        : undefined;
    const parent = parentRel
      ? readTsConfig(
          parentRel.endsWith(".json") ? parentRel : `${parentRel}.json`,
          seen,
        )
      : undefined;
    const options = json.compilerOptions ?? {};
    const baseUrl =
      typeof options.baseUrl === "string"
        ? path.posix.normalize(path.posix.join(dir, options.baseUrl))
        : parent?.baseUrl;
    const aliasBase = baseUrl ?? dir;
    const aliases: PathAlias[] =
      options.paths && typeof options.paths === "object"
        ? Object.entries(options.paths as Record<string, string[]>).map(
            ([key, targets]) => ({
              prefix: key.replace(/\*$/, ""),
              wildcard: key.endsWith("*"),
              targets: (Array.isArray(targets) ? targets : []).map((t) =>
                path.posix.normalize(path.posix.join(aliasBase, t)),
              ),
            }),
          )
        : (parent?.aliases ?? []);
    return { aliases, baseUrl };
  };

  /** 引用方最近的 tsconfig / jsconfig（逐级向上，止于仓根） */
  const tsConfigFor = (importer: string): TsResolveConfig | undefined => {
    let dir = path.posix.dirname(importer);
    const visited: string[] = [];
    for (;;) {
      if (tsConfigCache.has(dir)) {
        const hit = tsConfigCache.get(dir);
        visited.forEach((d) => tsConfigCache.set(d, hit));
        return hit;
      }
      visited.push(dir);
      const prefix = dir === "." ? "" : `${dir}/`;
      const config = ["tsconfig.json", "jsconfig.json"]
        .map((name) => `${prefix}${name}`)
        .find((candidate) => files.has(candidate));
      if (config) {
        const parsed = readTsConfig(config);
        visited.forEach((d) => tsConfigCache.set(d, parsed));
        return parsed;
      }
      if (dir === ".") {
        visited.forEach((d) => tsConfigCache.set(d, undefined));
        return undefined;
      }
      dir = path.posix.dirname(dir);
    }
  };

  const JS_SUFFIXES = [
    "",
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".d.ts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".vue",
    ".svelte",
    ".json",
  ];
  const resolveJsFile = (candidate: string): string | undefined => {
    const base = path.posix.normalize(candidate);
    if (base.startsWith("../") || base === "..") return undefined;
    const swapped = base.replace(/\.([cm]?)js$/, ".$1ts");
    for (const stem of swapped === base
      ? [base]
      : [base, swapped, base.replace(/\.js$/, ".tsx")]) {
      for (const suffix of JS_SUFFIXES) {
        if (files.has(`${stem}${suffix}`)) return `${stem}${suffix}`;
      }
    }
    for (const suffix of JS_SUFFIXES.slice(1)) {
      if (files.has(`${base}/index${suffix}`)) return `${base}/index${suffix}`;
    }
    return undefined;
  };

  const resolveJs = (importer: string, rawSpec: string): string | undefined => {
    const spec = rawSpec.replace(/[?#].*$/, "");
    if (spec.startsWith("./") || spec.startsWith("../")) {
      return resolveJsFile(path.posix.join(path.posix.dirname(importer), spec));
    }
    if (spec.startsWith("/")) return undefined;
    const config = tsConfigFor(importer);
    for (const alias of config?.aliases ?? []) {
      const hit = alias.wildcard
        ? spec.startsWith(alias.prefix)
        : spec === alias.prefix;
      if (!hit) continue;
      const rest = alias.wildcard ? spec.slice(alias.prefix.length) : "";
      for (const target of alias.targets) {
        const resolved = resolveJsFile(target.replace("*", rest));
        if (resolved) return resolved;
      }
    }
    return config?.baseUrl
      ? resolveJsFile(path.posix.join(config.baseUrl, spec))
      : undefined;
  };

  const pyModuleFile = (base: string): string | undefined =>
    [`${base}.py`, `${base}.pyi`, `${base}/__init__.py`].find((f) =>
      files.has(f),
    );

  /** Python 模块（`a.b.c` / 相对层级）→ 文件；`name` 为 from 导入的名字，可能是子模块 */
  const resolvePy = (
    importer: string,
    module: string,
    name?: string,
  ): string | undefined => {
    const dots = module.match(/^\.*/)![0].length;
    const parts = module.slice(dots).split(".").filter(Boolean);
    const join = (...segments: string[]) =>
      segments.filter((s) => s && s !== ".").join("/");
    const lookup = (root: string): string | undefined => {
      const base = join(root, ...parts);
      if (name) {
        const sub = pyModuleFile(join(base, name));
        if (sub) return sub;
      }
      return base ? pyModuleFile(base) : undefined;
    };
    if (dots) {
      let root = path.posix.dirname(importer);
      for (let i = 1; i < dots; i++) root = path.posix.dirname(root);
      return lookup(root);
    }
    if (!parts.length) return undefined;
    let dir = path.posix.dirname(importer);
    for (;;) {
      for (const root of [dir, dir === "." ? "src" : `${dir}/src`]) {
        const head = root === "." ? parts[0] : `${root}/${parts[0]}`;
        if (dirs.has(head) || pyModuleFile(head)) return lookup(root);
      }
      if (dir === ".") return undefined;
      dir = path.posix.dirname(dir);
    }
  };

  /** 扫一个文件的静态引用（只留落到跟踪文件上的） */
  return (file: string): ImportEdge[] => {
    const text = readTrackedText(projectRoot, file);
    if (text === undefined) return [];
    const edges: ImportEdge[] = [];
    const push = (spec: string, index: number, to?: string) => {
      if (to && to !== file)
        edges.push({ from: file, to, spec, line: lineAt(text, index) });
    };
    if (JS_EXTENSIONS.test(file)) {
      for (const m of text.matchAll(JS_IMPORT)) {
        const spec = m[1] ?? m[2] ?? m[3];
        push(spec, m.index! + m[0].indexOf(spec), resolveJs(file, spec));
      }
    } else if (PY_EXTENSIONS.test(file)) {
      for (const m of text.matchAll(PY_FROM)) {
        const names = m[2]
          .replace(/[()]/g, "")
          .split(",")
          .map((item) =>
            item
              .trim()
              .split(/\s+as\s+/)[0]
              .trim(),
          )
          .filter((item) => /^\w+$/.test(item));
        const targets = new Set(
          (names.length ? names : [undefined]).map((n) =>
            resolvePy(file, m[1], n),
          ),
        );
        for (const to of targets) push(m[1], m.index!, to);
      }
      for (const m of text.matchAll(PY_IMPORT)) {
        for (const item of m[1].split(",")) {
          const module = item
            .trim()
            .split(/\s+as\s+/)[0]
            .trim();
          if (module) push(module, m.index!, resolvePy(file, module));
        }
      }
    }
    return edges;
  };
};

const describeOwner = (owner: Owner): string =>
  owner.kind === "domain"
    ? `领域 \`${owner.name}\``
    : `共享骨架「${owner.label}」`;

/**
 * 引用闸：跨归属的引用只经被引方的公开入口。
 * ---
 * - 进入领域（来自别的领域、壳、壳测试、别的领域的测试）：目标须落在该领域 `public` 内。
 * - 领域进入共享骨架：骨架表有 public 列时，目标须落在该行 `public` 内；无该列不设限。
 * - 同一领域内、骨架内部互引不限；无主 / 排除的文件不参与（由归属闸报）。
 */
export const checkImports = (
  edges: ImportEdge[],
  ownership: OwnershipResult,
): string[] => {
  const errors: string[] = [];
  for (const edge of edges) {
    const from = ownership.owners.get(edge.from);
    const to = ownership.owners.get(edge.to);
    if (!from || !to) continue;
    if (to.kind === "domain") {
      if (from.kind === "domain" && from.name === to.name) continue;
      if (ownership.domainPublic.get(to.name)?.(edge.to)) continue;
      errors.push(
        `引用：${edge.from}:${edge.line} → ${edge.to}（${describeOwner(from)} 引 ${describeOwner(to)} 的内部文件，只许经其 public）`,
      );
    } else if (from.kind === "domain") {
      const isPublic = ownership.skeletonPublic[to.row];
      if (!isPublic || isPublic(edge.to)) continue;
      errors.push(
        `引用：${edge.from}:${edge.line} → ${edge.to}（${describeOwner(from)} 引 ${describeOwner(to)} 的内部文件，只许经该行 public）`,
      );
    }
  }
  return errors;
};
