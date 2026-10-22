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
 * 参数收最小结构（仅 type/ifExists），供 addFragment / writeFile 等写类 op 复用（DRY，逻辑零改）。
 */
export const guardIfExists = (
  ctx: OpContext,
  op: { type?: string; ifExists?: "error" | "keep" },
  target: string,
): boolean => {
  if (!ctx.vfs.has(target)) return true;
  const policy = op.ifExists ?? "error";
  if (policy === "error") {
    throw new Error(
      `${op.type ?? "op"} 目标已存在：${target}（ifExists 默认 error，显式 keep 才保留既有，D-M5）`,
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

/**
 * 目录铺开的单个产出条目（纯枚举，只读 fs 元数据）。
 * apply 按序落 VFS、effects 据此声明逐文件效果（R4：计划期模拟态须看见铺出的每个文件）——
 * 两处共用同一份遍历，[MUST NOT] 各写一套。
 */
type SpreadEntry =
  | { kind: "file"; sourceRel: string; target: string; mode: number }
  | { kind: "symlink"; absSrc: string; target: string }
  | { kind: "dir"; target: string };

/** 目录递归遍历单元（聚合参数，规避 max-params 3） */
interface WalkUnit {
  fragmentRoot: string;
  op: AddFragmentOp;
  /** 源根（fragment 相对） */
  srcRoot: string;
  /** 目标根（产物相对） */
  destRoot: string;
  /** 收集的产出条目（深度优先、同级按名排序） */
  out: SpreadEntry[];
}

/** 拼接相对路径（POSIX `/`） */
const joinRel = (a: string, b: string): string => (a === "" ? b : `${a}/${b}`);

/** 目标路径：destRoot + rename 映射后的相对路径 */
const targetOf = (unit: WalkUnit, relUnderRoot: string): string =>
  joinRel(unit.destRoot, applyRename(relUnderRoot, unit.op.rename));

/** 枚举一个目录条目（file/dir/symlink）。 */
const walkEntry = (unit: WalkUnit, relUnderRoot: string): void => {
  const { op } = unit;
  const sourceRel = joinRel(unit.srcRoot, relUnderRoot);
  const absSrc = path.resolve(unit.fragmentRoot, sourceRel);
  const lst = fs.lstatSync(absSrc);

  if (lst.isDirectory()) {
    walkDir(unit, relUnderRoot);
    return;
  }
  if (!isPathSelected(relUnderRoot, op)) return;
  const target = targetOf(unit, relUnderRoot);
  if (!lst.isSymbolicLink()) {
    unit.out.push({
      kind: "file",
      sourceRel,
      target,
      mode: resolveMode(op, lst.mode),
    });
    return;
  }
  // symlink 策略（preserve/deref/skip）
  const policy = op.symlinkPolicy ?? "preserve";
  if (policy === "skip") return;
  if (policy === "preserve") {
    unit.out.push({ kind: "symlink", absSrc, target });
    return;
  }
  // deref：按真实文件内容写入
  const st = fs.statSync(absSrc);
  unit.out.push({
    kind: "file",
    sourceRel,
    target,
    mode: resolveMode(op, st.mode),
  });
};

/**
 * 递归一个目录。R3/D3/修订-3：源本空 → 按 emptyDirPolicy 保真产 dir（含顶层 source 自身为空，
 * relUnderRoot==="" → target=destRoot，避免 joinRel 产畸形 `destRoot/`）；被 exclude/skip 滤空 → 不产空壳。
 */
const walkDir = (unit: WalkUnit, relUnderRoot: string): void => {
  const absDir = path.resolve(
    unit.fragmentRoot,
    joinRel(unit.srcRoot, relUnderRoot),
  );
  const names = fs.readdirSync(absDir).sort();
  for (const name of names) walkEntry(unit, joinRel(relUnderRoot, name));
  if (names.length > 0 || (unit.op.emptyDirPolicy ?? "keep") !== "keep") return;
  const target =
    relUnderRoot === "" ? unit.destRoot : targetOf(unit, relUnderRoot);
  unit.out.push({ kind: "dir", target });
};

/** 枚举目录源铺开后的全部产出条目（纯读，不碰 VFS）。 */
const enumerateSpread = (
  fragmentRoot: string,
  op: AddFragmentOp,
): SpreadEntry[] => {
  const unit: WalkUnit = {
    fragmentRoot,
    op,
    srcRoot: op.source,
    destRoot: op.target,
    out: [],
  };
  walkDir(unit, "");
  return unit.out;
};

/** 按条目落 VFS（经统一存在性守卫 H3）；返回是否产出节点。 */
const applyEntry = (
  ctx: OpContext,
  op: AddFragmentOp,
  entry: SpreadEntry,
): boolean => {
  if (entry.kind === "file") return writeFile(ctx, op, entry);
  if (entry.kind === "symlink") return writeSymlink(ctx, op, entry);
  if (!guardIfExists(ctx, op, entry.target)) return false;
  const node: VfsNode = {
    kind: "dir",
    provenance: { lastOpId: op.id, contributingOpIds: [op.id] },
  };
  ctx.vfs.setNode(entry.target, node);
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
  effects(op: AssembleOp, ctx?: PlanContext): TargetEffect[] {
    const o = narrow(op);
    // R4：目录源按铺出的每个文件声明效果，后续 delete 类 op 的计划期模拟才看得见它们。
    const targets =
      ctx && fs.lstatSync(sourceAbs(ctx, o.source)).isDirectory()
        ? enumerateSpread(ctx.fragmentRoot, o).map((e) => e.target)
        : [op.target];
    return targets.map((target) => ({
      target,
      kind: "write-whole",
      category: "content-model",
      createsTarget: true,
      // 整文件铺底（不解释格式）：与至多一个格式编辑模型可叠加，不计入混族互斥。
      replacesWhole: true,
    }));
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
      const results = enumerateSpread(ctx.fragmentRoot, o).map((entry) =>
        applyEntry(ctx, o, entry),
      );
      return { changed: results.includes(true), conflicts: [] };
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
