import path from "node:path";
import { compareCodePoint } from "./fs-entries";
import { readTrackedText } from "./git-files";
import { createMatcher } from "./glob";
import {
  PUBLIC_AUDIENCE_LABEL,
  type Owner,
  type OwnershipResult,
  type PublicCheck,
} from "./ownership";

/** 引用闸配置（`.done-coding/harness/governance/config.json` 的 `imports`） */
export interface ImportsConfig {
  /** 只查引用方落在这些模式内的引用（过渡期分段启用，如先只查前端）；缺省查全部代码文件 */
  include?: string[];
  /** 可选规则（缺省关）：跨归属 `from X import name` 的 name 须在 X 的 `__all__` 内 */
  exportedNames?: boolean;
  /** 测试文件的模式（public 的 `测试:` 条目据此判引用方），给出即替换缺省识别 */
  tests?: string[];
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
  /** Python `from 模块 import 名字` 落到模块本身时，导入的名字（子模块另成一条边） */
  names?: string[];
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

/** 换成等长空白（保留换行），行号与下标不变 */
const blank = (text: string): string => text.replace(/[^\n]/g, " ");

/**
 * Vue / Svelte 只留 `<script>` 块内容：`<script>` 与 import 写在同一行也能识别，
 * 模板里像 import 的文字不算。
 */
const scriptOnly = (text: string): string => {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script\s*>/gi)) {
    const start = m.index! + m[1].length;
    out += blank(text.slice(last, start)) + m[2];
    last = start + m[2].length;
  }
  return out + blank(text.slice(last));
};

/** Python 的字符串与注释（三引号优先）；正则从左到右取最早的起点，字符串里的 # 不会被当注释 */
const PY_STRING_OR_COMMENT =
  /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|#[^\n]*/g;

/** Python 只留语句：字符串（含文档字符串、`-c` 脚本）与注释里的 import 行不算引用 */
const pythonStatements = (text: string): string =>
  text.replace(PY_STRING_OR_COMMENT, blank);

/** pytest 收集测试时会把其「基准目录」加进 sys.path 的文件：测试模块与 conftest */
const isPytestModule = (file: string): boolean =>
  /(?:^|\/)(?:test_[^/]*|[^/]*_test|conftest)\.py$/.test(file);

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
 * - Python：相对导入；绝对导入从引用方所在目录逐级向上（含各级 `src/`）找首段包；
 *   测试模块找不到时，再按 pytest 缺省（prepend）导入模式加进 sys.path 的各测试基准目录找。
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
  /**
   * pytest 基准目录：测试模块所在目录向上第一个不含 `__init__.py` 的目录。
   * 收集时这些目录都会进 sys.path，测试之间可以按裸模块名互引（与收集顺序有关）。
   */
  const pytestRoots = [
    ...new Set(
      tracked.filter(isPytestModule).map((file) => {
        let dir = path.posix.dirname(file);
        while (dir !== "." && files.has(`${dir}/__init__.py`)) {
          dir = path.posix.dirname(dir);
        }
        return dir;
      }),
    ),
  ].sort(compareCodePoint);

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
    const hasHead = (root: string) => {
      const head = root === "." ? parts[0] : `${root}/${parts[0]}`;
      return dirs.has(head) || Boolean(pyModuleFile(head));
    };
    let dir = path.posix.dirname(importer);
    for (;;) {
      for (const root of [dir, dir === "." ? "src" : `${dir}/src`]) {
        if (hasHead(root)) return lookup(root);
      }
      if (dir === ".") break;
      dir = path.posix.dirname(dir);
    }
    if (!isPytestModule(importer)) return undefined;
    // 多个基准目录都有同名模块时，取与引用方共同前缀最长的（运行时取决于收集顺序）
    const shared = (root: string) =>
      root === "." ? 0 : importer.startsWith(`${root}/`) ? root.length : -1;
    const root = pytestRoots
      .filter(hasHead)
      .sort((a, b) => shared(b) - shared(a))[0];
    return root === undefined ? undefined : lookup(root);
  };

  /** `from 模块 import 名字`：名字是子模块的单独成边，其余是从模块本身取的名字 */
  const splitFromImport = (
    importer: string,
    spec: string,
    names: string[],
  ): { module?: string; subs: Set<string>; fromModule: string[] } => {
    const module = resolvePy(importer, spec);
    const subs = new Set<string>();
    const fromModule: string[] = [];
    for (const name of names) {
      const to = resolvePy(importer, spec, name);
      if (to && to !== module) subs.add(to);
      else fromModule.push(name);
    }
    return { module, subs, fromModule };
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
      const code = /\.(?:vue|svelte)$/.test(file) ? scriptOnly(text) : text;
      for (const m of code.matchAll(JS_IMPORT)) {
        const spec = m[1] ?? m[2] ?? m[3];
        push(spec, m.index! + m[0].indexOf(spec), resolveJs(file, spec));
      }
    } else if (PY_EXTENSIONS.test(file)) {
      const code = pythonStatements(text);
      for (const m of code.matchAll(PY_FROM)) {
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
        const { module, subs, fromModule } = splitFromImport(file, m[1], names);
        for (const to of subs) push(m[1], m.index!, to);
        if (module && (fromModule.length || !names.length)) {
          push(m[1], m.index!, module);
          const edge = edges[edges.length - 1];
          if (edge?.to === module && fromModule.length) edge.names = fromModule;
        }
      }
      for (const m of code.matchAll(PY_IMPORT)) {
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

/** 缺省的测试文件识别：测试目录、`*.test.*` / `*.spec.*`、pytest 与 go 的测试文件名 */
const DEFAULT_TEST_FILE =
  /(?:^|\/)(?:tests?|__tests__|spec)\/|\.(?:test|spec)\.[^/]+$|(?:^|\/)(?:test_[^/]*\.py|[^/]*_test\.(?:py|go)|conftest\.py)$/;

/** 引用闸附加判定 */
export interface CheckImportsOptions {
  /** 测试文件模式（`imports.tests`）；缺省按 DEFAULT_TEST_FILE */
  tests?: string[];
  /**
   * 读目标模块的 `__all__`（`imports.exportedNames` 打开时传入）；
   * 返回 undefined = 没写或不是字面量列表，无从判定，不报。
   */
  exportedNames?: (file: string) => Set<string> | undefined;
}

/** 从 Python 源码读字面量 `__all__`（`=` / `+=` 列表或元组）；有非字面量写法即返回 undefined */
export const readPythonAll = (text: string): Set<string> | undefined => {
  const assigns = text.match(/^__all__\b.*$/gm);
  if (!assigns) return undefined;
  const literal = [
    ...text.matchAll(
      /^__all__[ \t]*(?::[^=\n]*)?(\+?=)[ \t]*[[(]([^\])]*)[\])][ \t]*(?:#.*)?$/gm,
    ),
  ];
  if (literal.length !== assigns.length) return undefined;
  const names = new Set<string>();
  for (const m of literal) {
    if (m[1] === "=") names.clear();
    for (const q of m[2].matchAll(/["'](\w+)["']/g)) names.add(q[1]);
  }
  return names;
};

/**
 * 引用闸：跨归属的引用只经被引方的公开入口。
 * ---
 * - 进入领域（来自别的领域、壳、壳测试、别的领域的测试）：目标须落在该领域 `public` 内。
 * - 领域进入共享骨架：骨架表有 public 列时，目标须落在该行 `public` 内；无该列不设限。
 * - public 条目可带使用方前缀：`骨架:` 只对共享骨架开放，`测试:` 只对测试文件开放。
 * - 可选（`imports.exportedNames`）：跨归属 `from X import name` 的 name 须在 X 的 `__all__` 内。
 * - 同一领域内、骨架内部互引不限；无主 / 排除的文件不参与（由归属闸报）。
 */
export const checkImports = (
  edges: ImportEdge[],
  ownership: OwnershipResult,
  options: CheckImportsOptions = {},
): string[] => {
  const errors: string[] = [];
  const isTest = options.tests
    ? createMatcher(options.tests)
    : (file: string) => DEFAULT_TEST_FILE.test(file);
  for (const edge of edges) {
    const from = ownership.owners.get(edge.from);
    const to = ownership.owners.get(edge.to);
    if (!from || !to) continue;
    let check: PublicCheck | undefined;
    let scope: string;
    if (to.kind === "domain") {
      if (from.kind === "domain" && from.name === to.name) continue;
      check = ownership.domainPublic.get(to.name);
      scope = "其";
    } else if (from.kind === "domain") {
      check = ownership.skeletonPublic[to.row];
      if (!check) continue;
      scope = "该行";
    } else continue;
    const where = `引用：${edge.from}:${edge.line} → ${edge.to}`;
    const who = `${describeOwner(from)} 引 ${describeOwner(to)}`;
    const verdict = check
      ? check(edge.to, { kind: from.kind, isTest: isTest(edge.from) })
      : "no";
    if (verdict === "no") {
      errors.push(`${where}（${who} 的内部文件，只许经${scope} public）`);
      continue;
    }
    if (verdict !== "yes") {
      errors.push(
        `${where}（${who} 的入口，该入口只对${PUBLIC_AUDIENCE_LABEL[verdict]}开放）`,
      );
      continue;
    }
    const exported = edge.names && options.exportedNames?.(edge.to);
    const hidden = exported && edge.names!.filter((n) => !exported.has(n));
    if (hidden && hidden.length) {
      errors.push(
        `${where}（${who}：${hidden.join("、")} 不在 __all__ 内，只许取导出的名字）`,
      );
    }
  }
  return errors;
};
