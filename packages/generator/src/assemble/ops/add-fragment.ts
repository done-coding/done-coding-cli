/**
 * addFragment op（Wave B3，design §3.1 / §14 D-H7 边界字段 / D-M5 ifExists）。
 *
 * effect=write-whole；apply 经 readFragment 读源 → render → vfs.setFile/setNode。
 *  - 目录递归：include/exclude glob 过滤、rename 源→目标映射、mode preserve/指定、
 *    symlinkPolicy preserve/deref/skip、emptyDirPolicy keep/skip（D-H7）。
 *  - ifExists "error"|"keep"（D-M5，默认 error）；CI 默认不允许静默 skip（keep 输出 provenance）。
 *  - glob：包内/cli-utils 无现成 matcher，用 ../glob.ts 极简实现（报告记录），[MUST NOT] 新增重依赖。
 */
import fs from "node:fs";
import path from "node:path";
import type {
  AddFragmentOp,
  AssembleOp,
  OpContext,
  OpHandler,
  OpResult,
  PlanContext,
  TargetEffect,
  VfsNode,
} from "../types";
import { isPathSelected } from "../glob";
import { isBinaryBuffer } from "../render";

const narrow = (op: AssembleOp): AddFragmentOp =>
  op as unknown as AddFragmentOp;

/** 源在 fragmentRoot 下的绝对路径（越界由 readFragment 守，这里仅做元数据 lstat） */
const sourceAbs = (ctx: PlanContext, rel: string): string =>
  path.resolve(ctx.fragmentRoot, rel);

/** 应用 rename 映射（源相对路径 → 目标相对路径）；无映射原样。 */
const applyRename = (rel: string, rename?: Record<string, string>): string =>
  rename?.[rel] ?? rel;

/**
 * 解析 mode（R2/D2/修订-4）：preserve → 源 mode；number → 指定；
 * 默认（未指定）→ 保留源 mode（原为 undefined 落 umask，会丢可执行位）。
 * 仅作用 file 与 deref 后的 file；symlink preserve 不涉 mode，dir 不涉。
 */
const resolveMode = (op: AddFragmentOp, srcMode: number): number => {
  if (op.mode === "preserve") return srcMode & 0o777;
  if (typeof op.mode === "number") return op.mode;
  return srcMode & 0o777;
};

/**
 * 统一存在性守卫（H3）：file/dir/symlink 任一节点写入前一致经此。
 * 返回 true=继续写；false=keep 保留既有跳过。默认 error fail-loud（[MUST NOT] 静默覆盖）。
 */
const guardIfExists = (
  ctx: OpContext,
  op: AddFragmentOp,
  target: string,
): boolean => {
  if (!ctx.vfs.has(target)) return true;
  const policy = op.ifExists ?? "error";
  if (policy === "error") {
    throw new Error(
      `addFragment 目标已存在：${target}（ifExists 默认 error，显式 keep 才保留既有，D-M5）`,
    );
  }
  return false; // keep：保留既有
};

/** CRLF/CR → LF 规范化（M4 / D-H2，仅 render:true 路径统一 LF）。 */
const normalizeEol = (text: string): string => text.replace(/\r\n?/g, "\n");

/** 解析是否渲染（R1②/D1）：op.render > recipe.render > 内建 false。 */
const resolveRender = (
  op: AddFragmentOp,
  recipe: OpContext["recipe"],
): boolean => op.render ?? recipe.render ?? false;

/**
 * 写单个文件到 VFS（H3 守卫 + R1 raw 默认 / M1 二进制原样）。
 *  - raw（默认 / 二进制 / render 关）：Buffer 原样复制，不渲染不改 EOL（逐字节保留）。
 *  - render:true 文本碎片：readFragment(utf-8) → render → normalize LF → setFile。
 */
const writeFile = (
  ctx: OpContext,
  op: AddFragmentOp,
  arg: { sourceRel: string; target: string; mode?: number },
): boolean => {
  if (!guardIfExists(ctx, op, arg.target)) return false;
  const buf = ctx.readFragmentBuffer(arg.sourceRel);
  const doRender = resolveRender(op, ctx.recipe);
  const content =
    isBinaryBuffer(buf) || !doRender
      ? buf // raw：原样字节，不渲染/不改 EOL（逐字节保留）
      : Buffer.from(normalizeEol(ctx.render(buf.toString("utf-8"))), "utf-8");
  ctx.vfs.setFile(arg.target, content, op.id, { mode: arg.mode });
  return true;
};

/** 写 symlink 节点到 VFS（symlinkPolicy=preserve）；经统一存在性守卫（H3）。 */
const writeSymlink = (
  ctx: OpContext,
  op: AddFragmentOp,
  arg: { absSrc: string; target: string },
): boolean => {
  if (!guardIfExists(ctx, op, arg.target)) return false;
  ctx.vfs.setNode(arg.target, {
    kind: "symlink",
    linkTarget: fs.readlinkSync(arg.absSrc),
    provenance: { lastOpId: op.id, contributingOpIds: [op.id] },
  });
  return true;
};

/** 目录递归遍历单元（聚合参数，规避 max-params 3） */
interface WalkUnit {
  ctx: OpContext;
  op: AddFragmentOp;
  /** 源根（fragment 相对） */
  srcRoot: string;
  /** 目标根（产物相对） */
  destRoot: string;
}

/** 拼接相对路径（POSIX `/`） */
const joinRel = (a: string, b: string): string => (a === "" ? b : `${a}/${b}`);

/** 处理一个目录条目（file/dir/symlink），返回是否产出节点。 */
const walkEntry = (unit: WalkUnit, relUnderRoot: string): boolean => {
  const { ctx, op, srcRoot } = unit;
  const sourceRel = joinRel(srcRoot, relUnderRoot);
  const absSrc = sourceAbs(ctx, sourceRel);
  const lst = fs.lstatSync(absSrc);

  if (lst.isSymbolicLink()) {
    return handleSymlink(unit, relUnderRoot, absSrc);
  }
  if (lst.isDirectory()) {
    return walkDir(unit, relUnderRoot);
  }
  // file
  if (!isPathSelected(relUnderRoot, op)) return false;
  const target = joinRel(unit.destRoot, applyRename(relUnderRoot, op.rename));
  return writeFile(ctx, op, {
    sourceRel,
    target,
    mode: resolveMode(op, lst.mode),
  });
};

/** symlink 策略（preserve/deref/skip）。 */
const handleSymlink = (
  unit: WalkUnit,
  relUnderRoot: string,
  absSrc: string,
): boolean => {
  const { ctx, op } = unit;
  const policy = op.symlinkPolicy ?? "preserve";
  if (policy === "skip") return false;
  if (!isPathSelected(relUnderRoot, op)) return false;
  const target = joinRel(unit.destRoot, applyRename(relUnderRoot, op.rename));
  if (policy === "preserve") {
    return writeSymlink(ctx, op, { absSrc, target });
  }
  // deref：按真实文件内容写入
  const realRel = joinRel(unit.srcRoot, relUnderRoot);
  const st = fs.statSync(absSrc);
  return writeFile(ctx, op, {
    sourceRel: realRel,
    target,
    mode: resolveMode(op, st.mode),
  });
};

/** 递归一个目录；空目录按 emptyDirPolicy 决定是否产出 dir 节点。 */
const walkDir = (unit: WalkUnit, relUnderRoot: string): boolean => {
  const absDir = sourceAbs(unit.ctx, joinRel(unit.srcRoot, relUnderRoot));
  const names = fs.readdirSync(absDir).sort();
  let produced = 0;
  for (const name of names) {
    const childRel = joinRel(relUnderRoot, name);
    if (walkEntry(unit, childRel)) produced += 1;
  }
  if (produced === 0 && relUnderRoot !== "") {
    // R3/D3/修订-3：源本空 → 按 emptyDirPolicy 保真产 dir；被 exclude/skip 滤空 → 不产空壳。
    const sourceWasEmpty = names.length === 0;
    return sourceWasEmpty ? emitEmptyDir(unit, relUnderRoot) : false;
  }
  return produced > 0;
};

/** 空目录产出（emptyDirPolicy=keep 才产出 dir 节点）；经统一存在性守卫（H3）。 */
const emitEmptyDir = (unit: WalkUnit, relUnderRoot: string): boolean => {
  if ((unit.op.emptyDirPolicy ?? "keep") !== "keep") return false;
  const target = joinRel(
    unit.destRoot,
    applyRename(relUnderRoot, unit.op.rename),
  );
  if (!guardIfExists(unit.ctx, unit.op, target)) return false;
  const node: VfsNode = {
    kind: "dir",
    provenance: { lastOpId: unit.op.id, contributingOpIds: [unit.op.id] },
  };
  unit.ctx.vfs.setNode(target, node);
  return true;
};

/** 单 symlink 源（op.source 直接指向软链）：按 symlinkPolicy 写到 op.target。 */
const applySingleSymlink = (
  ctx: OpContext,
  op: AddFragmentOp,
  absSrc: string,
): boolean => {
  const policy = op.symlinkPolicy ?? "preserve";
  if (policy === "skip") return false;
  if (policy === "preserve") {
    return writeSymlink(ctx, op, { absSrc, target: op.target });
  }
  // deref
  const st = fs.statSync(absSrc);
  return writeFile(ctx, op, {
    sourceRel: op.source,
    target: op.target,
    mode: resolveMode(op, st.mode),
  });
};

export const addFragmentHandler: OpHandler = {
  effects(op: AssembleOp): TargetEffect[] {
    return [
      {
        target: op.target,
        kind: "write-whole",
        category: "content-model",
        createsTarget: true,
        // 整文件铺底（不解释格式）：与至多一个格式编辑模型可叠加，不计入混族互斥。
        replacesWhole: true,
      },
    ];
  },

  preflight(ctx: PlanContext, op: AssembleOp): void {
    const o = narrow(op);
    // 越界校验：源路径解析须在 fragmentRoot 内
    const root = path.resolve(ctx.fragmentRoot);
    const abs = sourceAbs(ctx, o.source);
    if (!(abs === root || abs.startsWith(root + path.sep))) {
      throw new Error(
        `addFragment 源越界 fragmentRoot：${o.source} → ${abs}（C2）`,
      );
    }
    fs.lstatSync(abs); // 不存在 → throw fail-loud
  },

  apply(ctx: OpContext, op: AssembleOp): OpResult {
    const o = narrow(op);
    const absSrc = sourceAbs(ctx, o.source);
    const lst = fs.lstatSync(absSrc);

    if (lst.isDirectory()) {
      const unit: WalkUnit = {
        ctx,
        op: o,
        srcRoot: o.source,
        destRoot: o.target,
      };
      const changed = walkDir(unit, "");
      return { changed, conflicts: [] };
    }

    if (lst.isSymbolicLink()) {
      const changed = applySingleSymlink(ctx, o, absSrc);
      return { changed, conflicts: [] };
    }

    // 单文件
    const changed = writeFile(ctx, o, {
      sourceRel: o.source,
      target: o.target,
      mode: resolveMode(o, lst.mode),
    });
    return { changed, conflicts: [] };
  },
};
