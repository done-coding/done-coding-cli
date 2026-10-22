/**
 * 注入编排（codegen-unified T4，design §四-补 ⓒ）。
 *
 * 把模块 spec 的 textPatch ops（注入声明）应用到**既有项目文件**（路由/菜单/export）。
 * 全内存先行、commit 前零落盘；复用 template 包 marker 引擎 + textPatchHandler，
 * [MUST NOT] 重实现 marker/路径/渲染逻辑。
 *
 *  - computeInjections：校验 + 在内存 VFS 上逐一 apply（任何 throw = 零落盘）。
 *  - commitInjections：把 compute 出的变更逐文件 temp+rename 原子落盘（保留原 mode）。
 *  - applyInjections = compute + commit 一体化（独立调用 / 简单消费方）。
 *
 * 原子性框架（design §四-补 ⓒ-5）由 tree 编排落实：
 *   ① compute 全部注入（内存）→ ② 页面 build（engine 原子 flush）→ ③ commit 注入。
 * 跨 flush 原子性不做（需动 engine 契约）；commit 中途崩溃由 marker 幂等 + 重跑自愈。
 */
import fs from "node:fs";
import path from "node:path";
import type { AssembleOp, OpContext, Recipe, TextPatchOp, Vfs } from "../types";
import { createVfs } from "../vfs";
import { createRender, readFragment, readFragmentBuffer } from "../render";
import { textPatchHandler } from "../ops/text-patch";
import { isInside } from "@/core/path-safe";

export interface InjectOptions {
  /** 项目根（注入 target 基准，= gitRoot） */
  gitRoot: string;
  /** 渲染变量（喂 createRender，对齐 recipe.vars） */
  vars: Record<string, unknown>;
  /** 碎片根绝对路径（op.source 越界基准） */
  fragmentRoot: string;
}

/** compute 阶段的产物：逐文件待落盘内容（gitRoot 相对键）。 */
export interface InjectionPlan {
  files: Array<{ rel: string; content: Buffer; mode?: number }>;
}

/** 最小占位 recipe（textPatchHandler.apply 不读 recipe；仅 OpContext 类型所需）。 */
const placeholderRecipe = (ops: TextPatchOp[]): Recipe => ({
  id: "__inject__",
  base: { kind: "empty" },
  output: "__inject__",
  // TextPatchOp 无 index signature，对齐 ops 层 narrow 的 as unknown as 造型
  ops: ops as unknown as AssembleOp[],
});

/**
 * 校验并读取单个注入目标。
 *  - abs = path.resolve(gitRoot, op.target)；
 *  - 目标文件 [MUST] 已存在（注入不存在的项目文件 = fail-loud，非静默创建）；
 *  - realpath 双解 + isInside 守卫（复用 @/core/path-safe）——symlink 逃逸 gitRoot fail-loud。
 * 返回 { rel, content, mode }。
 */
const resolveTarget = (
  gitRoot: string,
  op: TextPatchOp,
): { rel: string; content: Buffer; mode?: number } => {
  const abs = path.resolve(gitRoot, op.target);
  let st: fs.Stats;
  try {
    st = fs.statSync(abs);
  } catch {
    throw new Error(
      `注入目标不存在（注入须落在既有项目文件，不静默创建）：${op.target} → ${abs}`,
    );
  }
  if (!st.isFile()) {
    throw new Error(`注入目标非普通文件：${op.target} → ${abs}`);
  }
  const realRoot = fs.realpathSync(gitRoot);
  const realTarget = fs.realpathSync(abs);
  if (!isInside(realRoot, realTarget)) {
    throw new Error(
      `注入目标越界 gitRoot（symlink/相对逃逸）：${op.target} → ${realTarget}，不在 ${realRoot} 内`,
    );
  }
  return {
    rel: op.target,
    content: fs.readFileSync(abs),
    mode: st.mode & 0o777,
  };
};

/** 镜像 engine.buildOpContext 的 standalone 版本（fragmentRoot/vars 由调用方注入）。 */
const buildInjectContext = (
  vfs: Vfs,
  ops: TextPatchOp[],
  opts: InjectOptions,
): OpContext => ({
  vfs,
  recipe: placeholderRecipe(ops),
  fragmentRoot: opts.fragmentRoot,
  render: createRender(opts.vars),
  readFragment: (rel: string) =>
    readFragment(opts.fragmentRoot, rel, {
      dealMarkdown: rel.endsWith(".md"),
    }),
  readFragmentBuffer: (rel: string) =>
    readFragmentBuffer(opts.fragmentRoot, rel),
});

/**
 * 计算注入（全内存，不落盘）。
 * 任何 throw（目标不存在/越界/锚点多命中/渲染内容伪造等）= 零落盘。
 */
export const computeInjections = (
  ops: TextPatchOp[],
  opts: InjectOptions,
): InjectionPlan => {
  const gitRoot = path.resolve(opts.gitRoot);
  const vfs = createVfs();
  // ① 逐一校验 + seed 既有文件（注入语义：改既有，非创建）
  const targets = ops.map((op) => resolveTarget(gitRoot, op));
  for (const t of targets) {
    vfs.setFile(
      t.rel,
      t.content,
      "seed",
      t.mode !== undefined ? { mode: t.mode } : undefined,
    );
  }
  // ② 统一 op 上下文后逐一 apply（同文件多 key 经 VFS 天然顺序叠加）
  const ctx = buildInjectContext(vfs, ops, opts);
  for (const op of ops) {
    textPatchHandler.apply(ctx, op as unknown as AssembleOp);
  }
  // ③ 收集变更节点（VFS 键即 gitRoot 相对路径）
  const files: InjectionPlan["files"] = [];
  for (const rel of vfs.paths()) {
    const node = vfs.get(rel);
    if (!node || node.kind !== "file") continue;
    if (node.provenance.lastOpId === "seed") continue; // 未被任何 op 改动
    files.push({
      rel,
      content: node.content ?? Buffer.alloc(0),
      ...(node.mode !== undefined ? { mode: node.mode } : {}),
    });
  }
  return { files };
};

/**
 * 提交注入（逐文件 temp + rename 原子写，保留原 mode）。
 *  - 相对键 = 相对 gitRoot，防键逃逸：先 resolve + isInside 再写。
 *  - 单文件失败：清理该文件 temp 后上抛（已提交文件保持完整，marker 幂等可重跑）。
 */
export const commitInjections = (
  plan: InjectionPlan,
  opts: { gitRoot: string },
): void => {
  const gitRoot = path.resolve(opts.gitRoot);
  const realRoot = fs.realpathSync(gitRoot);
  for (const f of plan.files) {
    const abs = path.resolve(gitRoot, f.rel);
    const dirAbs = path.dirname(abs);
    // 落盘前 realpath 双解守卫（防 symlink 逃逸），先于 mkdir —— 避免 symlink 中间目录被
    // 递归 mkdir 在 guard 前写到越界路径（评审 Minor-2 修复）。
    // 父目录链尚未存在时，上溯到最近已存在祖先做守卫（保留递归 mkdir 对合法新路径的既往行为）。
    let realDir: string | null = null;
    let cur = dirAbs;
    while (realDir === null) {
      try {
        realDir = fs.realpathSync(cur);
      } catch {
        const parent = path.dirname(cur);
        if (parent === cur) {
          throw new Error(`注入提交路径无法解析：${f.rel}`);
        }
        cur = parent;
      }
    }
    if (!isInside(realRoot, realDir)) {
      throw new Error(`注入提交路径越界 gitRoot：${f.rel}`);
    }
    fs.mkdirSync(dirAbs, { recursive: true });
    const temp = path.join(
      path.dirname(abs),
      `.${path.basename(abs)}.inject-${process.pid}-${Date.now()}`,
    );
    try {
      fs.writeFileSync(temp, f.content);
      if (f.mode !== undefined) fs.chmodSync(temp, f.mode);
      fs.renameSync(temp, abs);
    } catch (err) {
      if (fs.existsSync(temp)) {
        fs.rmSync(temp, { force: true });
      }
      throw err;
    }
  }
};

/** 一体化注入（compute + commit；tree 编排用两阶段原语以守 ⓒ-5 顺序）。 */
export const applyInjections = (
  ops: TextPatchOp[],
  opts: InjectOptions,
): void => {
  commitInjections(computeInjections(ops, opts), opts);
};
