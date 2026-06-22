/**
 * 引擎编排（Wave C1，design §7 / §14 D-H1 / D-M3 / D-M6 / D-M8）。
 *
 *  - runPlan：构 baseVfs → plan()（全校验，不写盘）→ 返回 ExecutionPlan。
 *  - runBuild：plan 全过 → 顺序 op.apply(vfs) → readManifest(prev) → flush → writeManifest。
 *    任一步 throw 不落盘（flush 自身原子，D-M3）。
 *  - runDiff：flush 到临时目录（os.tmpdir，非原地）→ 与基准（worktree/head/index，D-M8）
 *    逐文件逐字节 diff（含元数据 mode/symlink + 孤儿双向）→ 返回 DriftResult（exit 码在 cli 边界）。
 *  - assertOutputsCompatible：--all 多 recipe output 冲突校验（相同/父子嵌套/base↔output 互指，D-M6）。
 *
 * 库函数 [MUST] throw / 返回结果，[MUST NOT] process.exit（退出码在 cli 边界，对齐 P3 B2/gen）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type {
  AssembleManifest,
  DiffAgainst,
  OpContext,
  Recipe,
  Vfs,
} from "./types";
import { plan, type ExecutionPlan } from "./planner";
import { resolveOp, registerBuiltinOps } from "./registry";
import {
  createVfs,
  flush,
  loadBaseDir,
  readManifest,
  writeManifest,
  type FlushOptions,
} from "./vfs";
import { createRender, readFragment, readFragmentBuffer } from "./render";
import { fragmentRoot as defaultFragmentRoot } from "./recipe";
import { assertCwdNotSuspiciousRoot } from "@/core/safe-root";

/** 引擎上下文（cwd 锚定约定目录 + 渲染变量来自 recipe.vars）。 */
export interface EngineCtx {
  /** 工作目录（约定 recipeDir/fragmentRoot/output/manifest 的基准） */
  cwd: string;
  /** 覆盖碎片根（缺省 `<cwd>/.done-coding/generator/assemble/fragments`） */
  fragmentRoot?: string;
  /** 显式逃逸可疑根守卫（修订-1，仅 runBuild destructive 入口生效；默认 false） */
  allowDangerous?: boolean;
  /** 注入家目录（缺省 os.homedir()），仅供可疑根守卫单测，[MUST NOT] 走 CLI 透传 */
  homeDir?: string;
}

const resolveFragmentRoot = (ctx: EngineCtx): string =>
  ctx.fragmentRoot ?? defaultFragmentRoot(ctx.cwd);

/** child 是否在 parent 内（含等于自身）。 */
const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/**
 * 解析 output 绝对路径并守越界（H2）：[MUST] 在 cwd 内且 ≠ cwd，否则 fail-loud。
 * output 后续会被 flush 做 ownership 检查 + 删除/替换，仓外/等于 cwd 会误删人为目录。
 */
const outputAbs = (ctx: EngineCtx, recipe: Recipe): string => {
  const root = path.resolve(ctx.cwd);
  const abs = path.resolve(root, recipe.output);
  if (abs === root) {
    throw new Error(
      `recipe.output 不得等于 cwd（会整体替换工作目录）：${recipe.output}（H2）`,
    );
  }
  if (!isInside(root, abs)) {
    throw new Error(
      `recipe.output 越界 cwd：${recipe.output} → ${abs}，[MUST] 落 cwd 内（H2）`,
    );
  }
  return abs;
};

/** plan/build/diff 入口统一调用，使 output 越界在 load/plan 期 fail-loud。 */
const assertOutputInside = (ctx: EngineCtx, recipe: Recipe): void => {
  outputAbs(ctx, recipe);
};

/** 构造 base VFS：empty=空；dir=loadBaseDir（相对 cwd）。 */
const buildBaseVfs = (ctx: EngineCtx, recipe: Recipe): Vfs => {
  const vfs = createVfs();
  if (recipe.base.kind === "dir") {
    const from = path.resolve(ctx.cwd, recipe.base.from);
    if (!isInside(path.resolve(ctx.cwd), from)) {
      throw new Error(
        `base.from 越界 cwd：${recipe.base.from} → ${from}（D-M7）`,
      );
    }
    loadBaseDir(vfs, from, { exclude: recipe.base.exclude });
  }
  return vfs;
};

/** 构造 op 执行上下文（vfs + render + readFragment，D-H6）。 */
const buildOpContext = (
  ctx: EngineCtx,
  recipe: Recipe,
  vfs: Vfs,
): OpContext => {
  const froot = resolveFragmentRoot(ctx);
  const render = createRender(recipe.vars ?? {});
  return {
    vfs,
    recipe,
    fragmentRoot: froot,
    render,
    readFragment: (rel: string) =>
      readFragment(froot, rel, { dealMarkdown: rel.endsWith(".md") }),
    readFragmentBuffer: (rel: string) => readFragmentBuffer(froot, rel),
  };
};

/** plan（dry-run，全校验，不写盘）。 */
export const runPlan = (recipe: Recipe, ctx: EngineCtx): ExecutionPlan => {
  registerBuiltinOps();
  assertOutputInside(ctx, recipe);
  const baseVfs = buildBaseVfs(ctx, recipe);
  // M3：plan 期开 dry-apply 预检（jsonMerge 冲突 / whole-file 覆盖在 plan 即 fail-loud）。
  return plan(recipe, {
    fragmentRoot: resolveFragmentRoot(ctx),
    baseVfs,
    buildOpContext: (dryVfs) => buildOpContext(ctx, recipe, dryVfs),
  });
};

/** build 选项（output 托管，D-H1）。 */
export interface BuildOptions {
  forceClean?: boolean;
  allowUntrackedDelete?: boolean;
}

export interface BuildResult {
  recipeId: string;
  output: string;
  files: string[];
}

/**
 * build：plan 全过 → 顺序执行 op.apply(vfs) → flush（manifest 驱动孤儿删除）→ writeManifest。
 * 任一步 throw 不落盘（flush 原子，D-M3）。
 */
export const runBuild = (
  recipe: Recipe,
  ctx: EngineCtx,
  opts: BuildOptions = {},
): BuildResult => {
  registerBuiltinOps();
  assertOutputInside(ctx, recipe);
  // 修订-1：仅真正写盘的 destructive 入口（runBuild）守 cwd 可疑根；plan/diff 不守（只读/落 tmp）。
  assertCwdNotSuspiciousRoot(ctx.cwd, {
    ...(ctx.allowDangerous !== undefined
      ? { allowDangerous: ctx.allowDangerous }
      : {}),
    ...(ctx.homeDir !== undefined ? { homeDir: ctx.homeDir } : {}),
  });
  const baseVfs = buildBaseVfs(ctx, recipe);
  // 先全量校验（族隔离 / 删不存在 / 越界 / 未知 type）
  plan(recipe, { fragmentRoot: resolveFragmentRoot(ctx), baseVfs });

  // 顺序执行（baseVfs 即执行树，与 plan 同初态）
  const opCtx = buildOpContext(ctx, recipe, baseVfs);
  for (const op of recipe.ops) {
    resolveOp(op.type).apply(opCtx, op);
  }

  const out = outputAbs(ctx, recipe);
  const prevManifest = readManifest(ctx.cwd, recipe.id);
  const flushOpts: FlushOptions = {
    ...(prevManifest ? { prevManifest } : {}),
    ...(opts.forceClean ? { forceClean: true } : {}),
    ...(opts.allowUntrackedDelete ? { allowUntrackedDelete: true } : {}),
    ...(opts.forceClean
      ? { gitClean: isGitPathClean(ctx.cwd, recipe.output) }
      : {}),
  };
  const { files } = flush(baseVfs, out, flushOpts);
  const manifest: AssembleManifest = {
    recipeId: recipe.id,
    output: recipe.output,
    files,
  };
  writeManifest(ctx.cwd, manifest);
  return { recipeId: recipe.id, output: recipe.output, files };
};

// ───────────────────────── diff / check（D-M8） ─────────────────────────

/** 单条漂移记录。 */
export interface DriftEntry {
  /** 相对 output 的文件路径 */
  file: string;
  /** 漂移种类 */
  kind:
    | "content"
    | "mode"
    | "kind"
    | "link"
    | "orphan-expected"
    | "orphan-actual";
  message: string;
}

export interface DriftResult {
  recipeId: string;
  output: string;
  against: DiffAgainst;
  drifted: boolean;
  entries: DriftEntry[];
}

export interface DiffOptions {
  /** 比对基准（缺省 worktree） */
  against?: DiffAgainst;
  /** 临时落盘根（缺省 os.tmpdir()） */
  outDir?: string;
}

/**
 * diff：flush 期望产物到临时目录（非原地）→ 与基准 output 逐文件逐字节 diff。
 * 任意 diff → drifted=true（exit 1 由 handler/cli 落）。
 */
export const runDiff = (
  recipe: Recipe,
  ctx: EngineCtx,
  opts: DiffOptions = {},
): DriftResult => {
  registerBuiltinOps();
  assertOutputInside(ctx, recipe);
  const baseVfs = buildBaseVfs(ctx, recipe);
  plan(recipe, { fragmentRoot: resolveFragmentRoot(ctx), baseVfs });
  const opCtx = buildOpContext(ctx, recipe, baseVfs);
  for (const op of recipe.ops) {
    resolveOp(op.type).apply(opCtx, op);
  }

  const against = opts.against ?? "worktree";
  const tmpRoot = fs.mkdtempSync(
    path.join(opts.outDir ?? os.tmpdir(), "assemble-diff-"),
  );
  const expectedDir = path.join(tmpRoot, "expected");
  try {
    // flush 到全新空目录（无既有文件→ ownership 守卫天然通过），物化期望产物
    flush(baseVfs, expectedDir);
    const baselineDir = resolveBaselineDir(ctx, recipe, { against, tmpRoot });
    const entries = diffTrees(baselineDir, expectedDir);
    return {
      recipeId: recipe.id,
      output: recipe.output,
      against,
      drifted: entries.length > 0,
      entries,
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
};

/** 解析基准目录：worktree=工作区 output；head/index=git 检出到临时目录。 */
const resolveBaselineDir = (
  ctx: EngineCtx,
  recipe: Recipe,
  arg: { against: DiffAgainst; tmpRoot: string },
): string => {
  if (arg.against === "worktree") {
    return outputAbs(ctx, recipe);
  }
  const baseDir = path.join(arg.tmpRoot, "baseline");
  fs.mkdirSync(baseDir, { recursive: true });
  checkoutGitTree({
    cwd: ctx.cwd,
    outputRel: recipe.output,
    against: arg.against,
    destDir: baseDir,
  });
  return baseDir;
};

// ───────────────────────── 树 diff（逐字节 + 元数据 + 孤儿） ─────────────────────────

/** 列出目录下全部相对节点（文件/目录/软链，字典序）。 */
const listTree = (root: string): string[] => {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (absDir: string, rel: string): void => {
    for (const name of fs.readdirSync(absDir).sort()) {
      const childAbs = path.join(absDir, name);
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const lst = fs.lstatSync(childAbs);
      out.push(childRel);
      if (lst.isDirectory() && !lst.isSymbolicLink()) walk(childAbs, childRel);
    }
  };
  walk(root, "");
  return out.sort();
};

interface NodeMeta {
  kind: VfsNodeKindLite;
  mode?: number;
  linkTarget?: string;
  content?: Buffer;
}

type VfsNodeKindLite = "file" | "dir" | "symlink";

const readNodeMeta = (abs: string): NodeMeta => {
  const lst = fs.lstatSync(abs);
  if (lst.isSymbolicLink()) {
    return { kind: "symlink", linkTarget: fs.readlinkSync(abs) };
  }
  if (lst.isDirectory()) return { kind: "dir" };
  return {
    kind: "file",
    mode: lst.mode & 0o777,
    content: fs.readFileSync(abs),
  };
};

/** 比对单个节点的元数据 + 内容（baseline vs expected），返回漂移条目。 */
const diffNode = (rel: string, a: NodeMeta, b: NodeMeta): DriftEntry[] => {
  if (a.kind !== b.kind) {
    return [
      {
        file: rel,
        kind: "kind",
        message: `节点类型不同：基准=${a.kind} 期望=${b.kind}`,
      },
    ];
  }
  if (a.kind === "symlink") {
    return a.linkTarget !== b.linkTarget
      ? [
          {
            file: rel,
            kind: "link",
            message: `软链目标不同：基准=${a.linkTarget} 期望=${b.linkTarget}`,
          },
        ]
      : [];
  }
  if (a.kind === "dir") return [];
  const entries: DriftEntry[] = [];
  if ((a.mode ?? 0) !== (b.mode ?? 0)) {
    entries.push({
      file: rel,
      kind: "mode",
      message: `权限位不同：基准=${(a.mode ?? 0).toString(8)} 期望=${(b.mode ?? 0).toString(8)}`,
    });
  }
  if (!(a.content ?? Buffer.alloc(0)).equals(b.content ?? Buffer.alloc(0))) {
    entries.push({
      file: rel,
      kind: "content",
      message: `文件内容漂移（逐字节不同）`,
    });
  }
  return entries;
};

/** 逐文件逐字节 diff（含双向孤儿 + 元数据）。 */
const diffTrees = (baselineDir: string, expectedDir: string): DriftEntry[] => {
  const baseSet = new Set(listTree(baselineDir));
  const expSet = new Set(listTree(expectedDir));
  const all = [...new Set([...baseSet, ...expSet])].sort();
  const entries: DriftEntry[] = [];
  for (const rel of all) {
    if (!baseSet.has(rel)) {
      entries.push({
        file: rel,
        kind: "orphan-expected",
        message: `基准缺失（期望新增）`,
      });
      continue;
    }
    if (!expSet.has(rel)) {
      entries.push({
        file: rel,
        kind: "orphan-actual",
        message: `期望缺失（基准多余/孤儿）`,
      });
      continue;
    }
    entries.push(
      ...diffNode(
        rel,
        readNodeMeta(path.join(baselineDir, rel)),
        readNodeMeta(path.join(expectedDir, rel)),
      ),
    );
  }
  return entries;
};

// ───────────────────────── git 边界（D-M8 / D-H1，本地壳，throw-only） ─────────────────────────

/** output 路径相对仓根（git pathspec 用）；非 git 仓时 throw。 */
const gitTopLevel = (cwd: string): string =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf-8",
  }).trim();

/** 探测 output 路径 git 工作树是否 clean（D-H1 forceClean 守卫）。非 git 仓 → false 保守。 */
export const isGitPathClean = (cwd: string, outputRel: string): boolean => {
  try {
    const status = execFileSync(
      "git",
      ["status", "--porcelain", "--", outputRel],
      { cwd, encoding: "utf-8" },
    );
    return status.trim().length === 0;
  } catch {
    return false;
  }
};

/** git 树中一条目（保留 mode/type，H4：120000=symlink，100755=可执行）。 */
interface GitTreeEntry {
  /** 仓根相对 POSIX 路径 */
  repoRel: string;
  /** 八进制 mode（如 100644 / 100755 / 120000） */
  mode: string;
}

/** 解析 head 基准条目（git ls-tree -rz -l，NUL 分隔保 mode）。 */
const listHeadEntries = (top: string, posixRel: string): GitTreeEntry[] =>
  execFileSync("git", ["ls-tree", "-rz", "HEAD", "--", posixRel], {
    cwd: top,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      // 格式：<mode> SP <type> SP <object> TAB <path>
      const tab = line.indexOf("\t");
      const meta = line.slice(0, tab).split(/\s+/);
      return { mode: meta[0], repoRel: line.slice(tab + 1) };
    });

/** 解析 index 基准条目（git ls-files -s，含 mode）。 */
const listIndexEntries = (top: string, posixRel: string): GitTreeEntry[] =>
  execFileSync("git", ["ls-files", "-s", "-z", "--", posixRel], {
    cwd: top,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      // 格式：<mode> SP <object> SP <stage> TAB <path>
      const tab = line.indexOf("\t");
      const meta = line.slice(0, tab).split(/\s+/);
      return { mode: meta[0], repoRel: line.slice(tab + 1) };
    });

/** 物化单条 git 条目到 destDir（按 mode 还原 symlink / 可执行位，H4）。 */
const writeGitEntry = (arg: {
  top: string;
  ref: string;
  entry: GitTreeEntry;
  posixRel: string;
  destDir: string;
}): void => {
  const { top, ref, entry, posixRel, destDir } = arg;
  const content = execFileSync("git", ["show", `${ref}${entry.repoRel}`], {
    cwd: top,
    maxBuffer: 64 * 1024 * 1024,
  });
  const rel = path.relative(posixRel, entry.repoRel);
  const abs = path.join(destDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (entry.mode === "120000") {
    // symlink：blob 内容即链接目标
    fs.symlinkSync(content.toString("utf-8"), abs);
    return;
  }
  fs.writeFileSync(abs, content);
  if (entry.mode === "100755") fs.chmodSync(abs, 0o755);
};

/** 把 output 子树从 head/index 检出到 destDir（保 mode/symlink，H4/D-M8）。 */
const checkoutGitTree = (arg: {
  cwd: string;
  outputRel: string;
  against: DiffAgainst;
  destDir: string;
}): void => {
  const { cwd, outputRel, against, destDir } = arg;
  const top = gitTopLevel(cwd);
  const ref = against === "head" ? "HEAD:" : ":";
  const posixRel = outputRel.split(path.sep).join("/");
  const entries =
    against === "head"
      ? listHeadEntries(top, posixRel)
      : listIndexEntries(top, posixRel);
  for (const entry of entries) {
    writeGitEntry({ top, ref, entry, posixRel, destDir });
  }
};

// ───────────────────────── --all 多 recipe output 冲突校验（D-M6） ─────────────────────────

/**
 * 多 recipe 的 output 互斥校验：禁相同 / 父子嵌套 / base(dir)↔output 互指。
 * 任意冲突 → throw（clean-regenerate 会互删，fail-loud）。
 */
export const assertOutputsCompatible = (
  ctx: EngineCtx,
  recipes: Recipe[],
): void => {
  const root = path.resolve(ctx.cwd);
  const outs = recipes.map((r) => ({
    id: r.id,
    abs: path.resolve(root, r.output),
  }));
  for (let i = 0; i < outs.length; i += 1) {
    for (let j = i + 1; j < outs.length; j += 1) {
      assertPairCompatible(outs[i], outs[j]);
    }
  }
  // base(dir)↔output 互指
  for (const r of recipes) {
    if (r.base.kind !== "dir") continue;
    const baseAbs = path.resolve(root, r.base.from);
    for (const o of outs) {
      if (o.id === r.id) continue;
      if (
        baseAbs === o.abs ||
        isInside(o.abs, baseAbs) ||
        isInside(baseAbs, o.abs)
      ) {
        throw new Error(
          `recipe「${r.id}」的 base.from 与 recipe「${o.id}」的 output 互指/嵌套：${baseAbs} ↔ ${o.abs}（D-M6，须显式依赖声明）`,
        );
      }
    }
  }
};

const assertPairCompatible = (
  a: { id: string; abs: string },
  b: { id: string; abs: string },
): void => {
  if (a.abs === b.abs) {
    throw new Error(
      `recipe「${a.id}」与「${b.id}」output 相同：${a.abs}（D-M6）`,
    );
  }
  if (isInside(a.abs, b.abs) || isInside(b.abs, a.abs)) {
    throw new Error(
      `recipe「${a.id}」与「${b.id}」output 父子嵌套：${a.abs} ↔ ${b.abs}（clean-regenerate 互删，D-M6）`,
    );
  }
};
