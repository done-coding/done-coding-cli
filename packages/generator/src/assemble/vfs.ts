/**
 * 内存虚拟文件树（VFS）+ base 载入 + 原子 flush + manifest（Wave B1）。
 *
 * 设计依据：design-p4a §4.4 + §14 D-H1（孤儿删除 / untracked 保护）/ D-H2（元数据纳入比对）/
 * D-H7（mode/symlink/空目录）/ D-M3（flush 原子 swap，sibling temp→rename，同父）/
 * D-M7（base 越界/循环 + 默认 exclude）/ D-L2（manifest 落 output 外 .assemble/manifests/）/
 * D-L4（provenance：lastOpId + contributingOpIds 累积）。
 *
 *  - createVfs：实现 types.ts 的 Vfs 接口（function-property 形态）。
 *  - loadBaseDir：整树读入（file 内容+mode / symlink linkTarget / 空目录保留）。
 *  - flush：写 sibling temp dir → 校验 → rename 顶替（跨设备 rename 失败回退到逐文件复制）。
 *  - 孤儿删除：仅删 prevManifest 列出且本次 VFS 不再产出者；output 存在 manifest 未记录文件
 *    → 默认 throw fail-loud（提示 --force-clean）；forceClean 全清且要求 gitClean 或 allowUntrackedDelete。
 *  - readManifest/writeManifest：<cwd>/.assemble/manifests/<recipeId>.json（output 外）。
 */
import fs from "node:fs";
import path from "node:path";
import type { AssembleManifest, Vfs, VfsNode, WriteProvenance } from "./types";

/** 默认排除（D-M7）：.git / node_modules / 常见临时目录 */
const DEFAULT_BASE_EXCLUDE = [".git", "node_modules", ".DS_Store", "tmp"];

/** child 是否在 parent 内（含等于自身，复刻 render.ts isInside 范式） */
const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/**
 * 归一 VFS 键：统一 posix 分隔 + 折叠 `./`·`..`·重复斜杠，使 `"./package.json"` 与
 * `"package.json"` 收敛为同键。否则 addFragment `target:"."` 铺根产 `./x` 键、jsonMerge 读裸 `x`
 * 不命中 → 空 base 静默覆盖丢数据（e2e 发现的 fail-loud 红线缺陷根因）。
 */
const normalizeKey = (p: string): string => {
  const norm = path.posix
    .normalize(p.split(path.sep).join("/"))
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  return norm === "." ? "" : norm;
};

/** 创建空内存 VFS（实现 types.ts Vfs 接口）。 */
export const createVfs = (): Vfs => {
  const tree = new Map<string, VfsNode>();

  const has = (p: string): boolean => tree.has(normalizeKey(p));
  const get = (p: string): VfsNode | undefined => tree.get(normalizeKey(p));

  /** setFile：维护 provenance（lastOpId + contributingOpIds 累积，D-L4）。
   * 4 参由 types.ts Vfs 契约固定（path/content/opId/opts），不可收束。 */
  /* eslint-disable max-params */
  const setFile = (
    p: string,
    content: Buffer,
    opId: string,
    opts?: { mode?: number },
  ): void => {
    /* eslint-enable max-params */
    const key = normalizeKey(p);
    const prev = tree.get(key);
    const contributing = prev?.provenance?.contributingOpIds?.slice() ?? [];
    if (!contributing.includes(opId)) contributing.push(opId);
    const node: VfsNode = {
      kind: "file",
      content,
      provenance: { lastOpId: opId, contributingOpIds: contributing },
    };
    const mode = opts?.mode ?? prev?.mode;
    if (mode !== undefined) node.mode = mode;
    tree.set(key, node);
  };

  const setNode = (p: string, node: VfsNode): void => {
    tree.set(normalizeKey(p), node);
  };

  const del = (p: string): boolean => tree.delete(normalizeKey(p));

  /** 全部路径（字典序，确定性遍历） */
  const paths = (): string[] => [...tree.keys()].sort();

  return { has, get, setFile, setNode, delete: del, paths };
};

// ───────────────────────── base 载入（D-M7 / D-H7） ─────────────────────────

const makeProvenance = (opId: string): WriteProvenance => ({
  lastOpId: opId,
  contributingOpIds: [opId],
});

const isExcluded = (name: string, exclude: string[]): boolean =>
  exclude.includes(name);

interface LoadCtx {
  vfs: Vfs;
  absRoot: string;
  exclude: string[];
  opId: string;
}

/** 递归载入单个目录条目（file/symlink/dir，越界与循环已由 caller 守） */
const loadEntry = (ctx: LoadCtx, absPath: string, rel: string): void => {
  const lst = fs.lstatSync(absPath);
  if (lst.isSymbolicLink()) {
    ctx.vfs.setNode(rel, {
      kind: "symlink",
      linkTarget: fs.readlinkSync(absPath),
      provenance: makeProvenance(ctx.opId),
    });
    return;
  }
  if (lst.isDirectory()) {
    loadDir(ctx, absPath, rel);
    return;
  }
  if (lst.isFile()) {
    ctx.vfs.setNode(rel, {
      kind: "file",
      content: fs.readFileSync(absPath),
      mode: lst.mode & 0o777,
      provenance: makeProvenance(ctx.opId),
    });
  }
};

/** 递归载入目录；空目录保留为 dir 节点（D-H7 emptyDir） */
const loadDir = (ctx: LoadCtx, absDir: string, rel: string): void => {
  const entries = fs.readdirSync(absDir).sort();
  const kept = entries.filter((n) => !isExcluded(n, ctx.exclude));
  if (kept.length === 0 && rel !== "") {
    // 空目录（排除后亦空）保留为 dir 节点
    ctx.vfs.setNode(rel, {
      kind: "dir",
      provenance: makeProvenance(ctx.opId),
    });
    return;
  }
  for (const name of kept) {
    const childAbs = path.join(absDir, name);
    const childRel = rel === "" ? name : `${rel}/${name}`;
    loadEntry(ctx, childAbs, childRel);
  }
};

/**
 * 把成品目录整树读入 VFS（裁剪方向初态，design §4.4）。
 *  - file：Buffer + mode；symlink：linkTarget；空目录：保留 dir 节点。
 *  - 默认 exclude .git/node_modules/临时目录（D-M7），可经 opts.exclude 覆盖。
 *  - absDir 不存在 → throw（C10）。
 */
export const loadBaseDir = (
  vfs: Vfs,
  absDir: string,
  opts?: { exclude?: string[]; opId?: string },
): void => {
  const absRoot = path.resolve(absDir);
  if (!fs.existsSync(absRoot)) {
    throw new Error(`base.kind="dir" 来源不存在：${absRoot}`);
  }
  const st = fs.statSync(absRoot);
  if (!st.isDirectory()) {
    throw new Error(`base.kind="dir" 来源非目录：${absRoot}`);
  }
  const ctx: LoadCtx = {
    vfs,
    absRoot,
    exclude: opts?.exclude ?? DEFAULT_BASE_EXCLUDE,
    opId: opts?.opId ?? "__base__",
  };
  loadDir(ctx, absRoot, "");
};

// ───────────────────────── manifest（D-L2 / D-H1） ─────────────────────────

const manifestPath = (cwd: string, recipeId: string): string =>
  path.join(path.resolve(cwd), ".assemble", "manifests", `${recipeId}.json`);

/** 读 manifest（不存在返回 undefined）。 */
export const readManifest = (
  cwd: string,
  recipeId: string,
): AssembleManifest | undefined => {
  const p = manifestPath(cwd, recipeId);
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as AssembleManifest;
};

/** 写 manifest（落 output 外 .assemble/manifests/，入版控）。 */
export const writeManifest = (
  cwd: string,
  manifest: AssembleManifest,
): void => {
  const p = manifestPath(cwd, manifest.recipeId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
};

// ───────────────────────── flush（D-M3 原子 swap + D-H1 孤儿删除） ─────────────────────────

export interface FlushOptions {
  /** 上次生成清单（D-H1 安全删除依据） */
  prevManifest?: AssembleManifest;
  /** 全量清空 output（含 untracked），需 gitClean 或 allowUntrackedDelete */
  forceClean?: boolean;
  allowUntrackedDelete?: boolean;
  /** 调用方探测的 output 路径 git 工作树 clean 状态（D-H1） */
  gitClean?: boolean;
}

/** flush 结果（供 engine 写 manifest）。 */
export interface FlushResult {
  /** 本次落地文件清单（相对 output，字典序） */
  files: string[];
}

/** 列出 output 现存的全部相对文件路径（含目录，字典序）。 */
const listExisting = (outputAbs: string): string[] => {
  if (!fs.existsSync(outputAbs)) return [];
  const out: string[] = [];
  const walk = (absDir: string, rel: string): void => {
    for (const name of fs.readdirSync(absDir).sort()) {
      const childAbs = path.join(absDir, name);
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const lst = fs.lstatSync(childAbs);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        out.push(childRel);
        walk(childAbs, childRel);
      } else {
        out.push(childRel);
      }
    }
  };
  walk(outputAbs, "");
  return out.sort();
};

/**
 * D-H1 untracked 守卫：output 现存但 manifest 未记录的文件 = 人为 untracked。
 *  - 非 forceClean 且存在 untracked → throw（提示 --force-clean）。
 *  - forceClean 但 !gitClean && !allowUntrackedDelete → throw（要 git clean 或显式放行）。
 */
const assertOutputOwnership = (outputAbs: string, opts: FlushOptions): void => {
  const existing = listExisting(outputAbs);
  // 仅看文件层级；目录是否 untracked 由其内容决定，简化为文件集合判定
  const tracked = new Set(opts.prevManifest?.files ?? []);
  const untracked = existing.filter(
    (rel) => !tracked.has(rel) && !isAncestorOfTracked(rel, tracked),
  );
  if (opts.forceClean) {
    if (!opts.gitClean && !opts.allowUntrackedDelete) {
      throw new Error(
        `--force-clean 需 output 路径 git 工作树 clean，或追加 --allow-untracked-delete 显式放行：${outputAbs}`,
      );
    }
    return;
  }
  if (untracked.length > 0) {
    throw new Error(
      `output 存在 manifest 未记录的文件（人为 untracked，受保护）：\n` +
        untracked.map((f) => `  - ${f}`).join("\n") +
        `\n如确需全量重写，使用 --force-clean（要求 git clean 或 --allow-untracked-delete）。`,
    );
  }
};

// ───────────────────────── case-fold 塌路径守卫（修订-2 / R2） ─────────────────────────

/** 把 posix 相对路径拆成所有前缀（含自身），如 "A/x/y" → ["A","A/x","A/x/y"]。 */
const pathPrefixes = (rel: string): string[] => {
  const segs = rel.split("/").filter(Boolean);
  const out: string[] = [];
  let acc = "";
  for (const seg of segs) {
    acc = acc === "" ? seg : `${acc}/${seg}`;
    out.push(acc);
  }
  return out;
};

/**
 * 修订-2：case-fold 塌路径守卫（FS 无关、确定性，throw 前不动 fs）。
 *  ① 把每个 VFS 键的**所有路径前缀**纳入 folded(小写) map；任一 folded prefix 命中多个不同
 *     原始 prefix → 大小写塌陷 fail-loud（覆盖 `A/x` vs `a/y` 的父目录 `A`/`a` 塌陷）。
 *  ② 另检测 folded 后「file 节点是另一节点祖先」的 file-vs-dir 类型塌陷（如 `Foo` 文件 vs `foo/bar`）。
 * 报错列出冲突原始路径对 + 类别。
 */
export const assertNoCaseCollision = (vfs: Vfs): void => {
  const keys = vfs.paths();
  // ① file-vs-dir 类型塌陷（先于②判，使「文件 folded 后充当他人祖先目录」归类型塌陷而非泛大小写）：
  //    某 file 节点 folded 后成为另一节点（folded）的严格祖先前缀 → 在大小写不敏感 FS 上 file 与 dir 无法共存。
  const foldedFiles = new Map<string, string>(); // folded leaf → 原始 file 键
  for (const key of keys) {
    if (vfs.get(key)?.kind === "file") foldedFiles.set(key.toLowerCase(), key);
  }
  for (const key of keys) {
    // 仅看严格祖先（去掉自身）
    for (const prefix of pathPrefixes(key).slice(0, -1)) {
      const fileOrig = foldedFiles.get(prefix.toLowerCase());
      if (
        fileOrig !== undefined &&
        fileOrig.toLowerCase() !== key.toLowerCase()
      ) {
        throw new Error(
          `大小写折叠类型塌陷：文件「${fileOrig}」与路径「${key}」折叠后前者成为后者的祖先目录、` +
            `在大小写不敏感 FS 上无法共存；请重命名其一（类别：类型塌陷）`,
        );
      }
    }
  }
  // ② 大小写塌陷：folded prefix → 首个原始 prefix；命中多个不同原始 prefix → 塌路径冲突。
  const foldedToOrig = new Map<string, string>();
  for (const key of keys) {
    for (const prefix of pathPrefixes(key)) {
      const folded = prefix.toLowerCase();
      const prev = foldedToOrig.get(folded);
      if (prev !== undefined && prev !== prefix) {
        throw new Error(
          `大小写塌路径冲突：「${prev}」与「${prefix}」在大小写不敏感 FS(macOS/Win) 上塌到同一路径、` +
            `会静默互覆盖；请重命名其一（类别：大小写塌陷）`,
        );
      }
      if (prev === undefined) foldedToOrig.set(folded, prefix);
    }
  }
};

/** rel 是否是某 tracked 文件的祖先目录（目录条目不算 untracked） */
const isAncestorOfTracked = (rel: string, tracked: Set<string>): boolean => {
  const prefix = rel + "/";
  for (const t of tracked) {
    if (t.startsWith(prefix)) return true;
  }
  return false;
};

/** 把 VFS 全树物化到目标目录（绝对路径，目录须已存在或新建）。 */
const materialize = (vfs: Vfs, destAbs: string): string[] => {
  const files: string[] = [];
  for (const rel of vfs.paths()) {
    const node = vfs.get(rel);
    if (!node) continue;
    const abs = path.join(destAbs, rel);
    if (!isInside(destAbs, abs)) {
      throw new Error(`VFS 路径越界 output：${rel}`);
    }
    if (node.kind === "dir") {
      fs.mkdirSync(abs, { recursive: true });
      files.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (node.kind === "symlink") {
      if (node.linkTarget === undefined) {
        throw new Error(`symlink 节点缺 linkTarget：${rel}`);
      }
      fs.symlinkSync(node.linkTarget, abs);
      files.push(rel);
      continue;
    }
    // file
    fs.writeFileSync(abs, node.content ?? Buffer.alloc(0));
    if (node.mode !== undefined) fs.chmodSync(abs, node.mode);
    files.push(rel);
  }
  return files.sort();
};

/**
 * 原子三段式 swap（D-M3）：temp 就位前 [MUST NOT] 删旧 output。
 *  ① output→backup（旧 output 让位但不丢）；② temp→output（新产物就位）；③ 删 backup。
 *  任一步失败 → 回滚 backup→output 恢复旧产物，[MUST NOT] 留半成品。
 *  EXDEV（跨设备 rename）兜底：copy+rm，但同样守"新就位前不毁旧"——失败时回滚已复制的 output。
 */
const swapInto = (tempAbs: string, outputAbs: string): void => {
  const hadOutput = fs.existsSync(outputAbs);
  const backup = hadOutput
    ? `${outputAbs}.assemble-backup-${process.pid}-${Date.now()}`
    : undefined;
  // 三段全程纳入 try：①output→backup（旧产物让位但不丢）②temp→output（新产物就位）。
  // 任一步失败 → 按是否已备份分别回滚，[MUST NOT] 留半成品（codex 终审 H1）。
  let backedUp = false;
  try {
    if (backup) {
      renameOrCopy(outputAbs, backup); // ①
      backedUp = true;
    }
    renameOrCopy(tempAbs, outputAbs); // ②
  } catch (err) {
    if (backedUp) {
      // ① 已成功：旧产物在 backup；删 ② 半成品 output，backup 复位旧产物
      if (fs.existsSync(outputAbs)) {
        fs.rmSync(outputAbs, { recursive: true, force: true });
      }
      if (backup && fs.existsSync(backup)) renameOrCopy(backup, outputAbs);
    } else if (backup && fs.existsSync(backup)) {
      // ① 失败：旧 output 仍在原位，清理可能的半成品 backup
      fs.rmSync(backup, { recursive: true, force: true });
    }
    throw err;
  } finally {
    // temp 始终清理（成功已被 rename 走；失败/EXDEV 复制残留则删）
    if (fs.existsSync(tempAbs)) {
      fs.rmSync(tempAbs, { recursive: true, force: true });
    }
  }
  // ③ 成功，删 backup
  if (backup && fs.existsSync(backup)) {
    fs.rmSync(backup, { recursive: true, force: true });
  }
};

/** rename 优先；EXDEV（跨设备）回退到递归复制 + 删源。两路均整体就位（复制失败清半成品 dest，保 src 完整）。 */
const renameOrCopy = (srcAbs: string, destAbs: string): void => {
  try {
    fs.renameSync(srcAbs, destAbs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      try {
        fs.cpSync(srcAbs, destAbs, { recursive: true });
      } catch (copyErr) {
        // 复制中途失败：删半成品 dest，src 保持完整后上抛（不毁旧）
        if (fs.existsSync(destAbs)) {
          fs.rmSync(destAbs, { recursive: true, force: true });
        }
        throw copyErr;
      }
      fs.rmSync(srcAbs, { recursive: true, force: true });
      return;
    }
    throw err;
  }
};

/**
 * 原子 flush（D-M3）：写 sibling temp dir（与 output 同父）→ 校验 → 三段式 swap 顶替。
 *  - 中途失败保留原 output（swapInto 自管回滚 backup→output + temp 清理）。
 *  - 孤儿删除（D-H1）由整体替换天然实现：新 output = VFS 全树，旧 output 经 backup
 *    让位后删除；untracked 守卫见 assertOutputOwnership。
 * 返回本次落地文件清单（供 engine 写 manifest）。
 */
export const flush = (
  vfs: Vfs,
  outputAbs: string,
  opts: FlushOptions = {},
): FlushResult => {
  const output = path.resolve(outputAbs);
  // D-H1 所有权守卫（throw 前不动 fs）
  assertOutputOwnership(output, opts);
  // 修订-2：case-fold 塌路径守卫（materialize 前，throw 前不动 fs）
  assertNoCaseCollision(vfs);

  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(parent, ".assemble-flush-"));
  let files: string[];
  try {
    files = materialize(vfs, temp);
  } catch (err) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw err;
  }
  // swapInto 内部自管失败回滚 + temp 清理（temp 就位前不删旧 output）
  swapInto(temp, output);
  return { files };
};
