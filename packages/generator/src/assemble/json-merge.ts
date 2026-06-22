/**
 * jsonMerge 算法（A-L5 新建，structured 族核心，design §6 + **§14 D-H8 策略表**）。
 *
 *  - 对象递归深合并；标量同 key 异值 → 冲突；类型不符 → 冲突。
 *  - package.json 专用策略表（D-H8）：deps 系列同包异版本冲突 / scripts·bin 同名异值冲突 /
 *    files·keywords·man 数组去重并集（保序）/ exports·imports 仅相等或新增不冲突 key 且
 *    [MUST NOT] 全局排序条件对象 / workspaces·overrides·resolutions·pnpm·peerDependenciesMeta
 *    默认 error / 其它数组异值冲突。
 *  - 冲突不静默：返回 conflicts 列表（由调用方填 file 占位并 throw），另提供 assertNoConflict。
 *  - 确定性序列化：[MUST NOT] 全局排序 key（保插入顺序 / Node exports 解析语义，D-H2/D-H8）。
 *
 * [MUST NOT] 复用 lodash.merge（静默覆盖不可用，A-L5）。
 */
import type { Conflict, ConflictSide } from "./types";
import { detectEol } from "@done-coding/cli-template";
import { assertNoConflicts } from "./conflict";

/** 字段缺省策略（可被 op.fieldPolicy 按 JSON Pointer 覆盖，A-NFR-4） */
export type FieldPolicy = "union" | "replace" | "error";

/** jsonMerge 入参（按对象传，规避 max-params 3） */
export interface JsonMergeOptions {
  recipeId: string;
  /** base 一侧来源（provenance；默认 op id 由调用方补） */
  baseSource?: string;
  /** patch 一侧来源 */
  patchSource?: string;
  /** 按 JSON Pointer 覆盖缺省策略表（A-NFR-4 留口，D-H8） */
  fieldPolicy?: Record<string, FieldPolicy>;
}

export interface JsonMergeResult {
  result: unknown;
  conflicts: Conflict[];
}

type Json = unknown;
type JsonObject = Record<string, Json>;

const isObject = (v: Json): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** deps 系列：对象按包名 merge，同包异版本冲突 */
const DEP_FIELDS = new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]);

/** 默认 error 字段（语义复杂，本期不自动合并，要合并须显式 fieldPolicy） */
const ERROR_FIELDS = new Set([
  "peerDependenciesMeta",
  "overrides",
  "resolutions",
  "pnpm",
  "workspaces",
]);

/** 数组去重并集（保序）字段 */
const ARRAY_UNION_FIELDS = new Set(["files", "keywords", "man"]);

/** 对象按 key merge、同 key 异值冲突 字段（scripts / bin 对象形态） */
const OBJECT_KEY_MERGE_FIELDS = new Set(["scripts", "bin"]);

/** exports / imports：仅相等或新增不冲突 key，[MUST NOT] 全局排序条件对象 */
const EXPORTS_FIELDS = new Set(["exports", "imports"]);

const deepEqual = (a: Json, b: Json): boolean => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]),
    );
  }
  return false;
};

const childPointer = (parent: string, key: string): string =>
  `${parent}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;

/** merge 过程中可变的工作上下文（聚合冲突，避免参数透传超 3） */
interface MergeCtx {
  conflicts: Conflict[];
  opts: JsonMergeOptions;
}

const makeConflict = (
  ctx: MergeCtx,
  locator: string,
  message: string,
): Conflict => {
  const sides: ConflictSide[] = [
    { opId: "", source: ctx.opts.baseSource },
    { opId: "", source: ctx.opts.patchSource },
  ];
  return {
    recipeId: ctx.opts.recipeId,
    file: "", // 占位，由调用方（op handler）填具体产物路径
    locator,
    sides,
    message,
  };
};

/**
 * 单次合并对的工作单元：pointer + 两侧值。
 * 收束为对象参数以满足 max-params 3（ctx + pair）。
 */
interface MergePair {
  /** 当前节点 JSON Pointer（根为 ""） */
  pointer: string;
  base: Json;
  patch: Json;
}

/** 数组去重并集（保序：base 序 + patch 新增追加） */
const unionArray = (base: Json[], patch: Json[]): Json[] => {
  const out = [...base];
  for (const item of patch) {
    if (!out.some((x) => deepEqual(x, item))) out.push(item);
  }
  return out;
};

/**
 * 对象按 key merge：同 key 异值 push 冲突（msgFor 定制文案），新增 key 直接接受不排序。
 * 覆盖 deps（同包异版本）/ scripts·bin（同名异值）/ exports·imports（条件 key 冲突）三类。
 */
const mergeObjectKeys = (
  ctx: MergeCtx,
  pair: { pointer: string; base: JsonObject; patch: JsonObject },
  msgFor: (key: string, baseVal: Json, patchVal: Json) => string,
): JsonObject => {
  const out: JsonObject = { ...pair.base };
  for (const key of Object.keys(pair.patch)) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      if (!deepEqual(out[key], pair.patch[key])) {
        ctx.conflicts.push(
          makeConflict(
            ctx,
            childPointer(pair.pointer, key),
            msgFor(key, out[key], pair.patch[key]),
          ),
        );
      }
    } else {
      out[key] = pair.patch[key]; // 新增 key：直接接受，不排序
    }
  }
  return out;
};

const depConflictMsg = (key: string, b: Json, p: Json): string =>
  `同包异版本冲突：${key} 既有 ${JSON.stringify(b)} 又有 ${JSON.stringify(p)}`;
const objKeyConflictMsg = (key: string, b: Json, p: Json): string =>
  `同 key 异值冲突：${key} 既有 ${JSON.stringify(b)} 又有 ${JSON.stringify(p)}`;
const exportsConflictMsg = (key: string): string =>
  `exports/imports 条件 key 冲突：${key}（默认不自动合并，须显式 fieldPolicy）`;

/** 标量/非容器相等保留、异值 push 冲突（统一收口）。 */
const conflictIfUnequal = (
  ctx: MergeCtx,
  pair: MergePair,
  msg: string,
): Json => {
  if (!deepEqual(pair.base, pair.patch)) {
    ctx.conflicts.push(makeConflict(ctx, pair.pointer || "", msg));
  }
  return pair.base;
};

/** 处理被显式 fieldPolicy 覆盖的字段。 */
const applyOverridePolicy = (
  ctx: MergeCtx,
  pair: MergePair,
  policy: FieldPolicy,
): Json => {
  const { pointer, base, patch } = pair;
  if (policy === "replace") return patch;
  if (policy === "union") {
    if (Array.isArray(base) && Array.isArray(patch))
      return unionArray(base, patch);
    if (isObject(base) && isObject(patch))
      return mergeObjectKeys(ctx, { pointer, base, patch }, objKeyConflictMsg);
    return conflictIfUnequal(
      ctx,
      pair,
      `union 策略不适用于标量异值：${pointer}`,
    );
  }
  // error 策略：异值即冲突，相等保留
  return conflictIfUnequal(
    ctx,
    pair,
    `字段 ${pointer} 策略为 error：拒绝自动合并异值`,
  );
};

/** 命名字段策略分派（package.json 专用表，仅顶层字段调用）。 */
const mergeNamedField = (ctx: MergeCtx, key: string, pair: MergePair): Json => {
  const { pointer, base, patch } = pair;
  if (DEP_FIELDS.has(key) && isObject(base) && isObject(patch))
    return mergeObjectKeys(ctx, { pointer, base, patch }, depConflictMsg);
  if (
    ARRAY_UNION_FIELDS.has(key) &&
    Array.isArray(base) &&
    Array.isArray(patch)
  )
    return unionArray(base, patch);
  if (OBJECT_KEY_MERGE_FIELDS.has(key) && isObject(base) && isObject(patch))
    return mergeObjectKeys(ctx, { pointer, base, patch }, objKeyConflictMsg);
  if (EXPORTS_FIELDS.has(key) && isObject(base) && isObject(patch))
    return mergeObjectKeys(ctx, { pointer, base, patch }, (k) =>
      exportsConflictMsg(k),
    );
  if (ERROR_FIELDS.has(key))
    return conflictIfUnequal(
      ctx,
      pair,
      `字段 ${key} 默认 error（语义复杂不自动合并，须显式 fieldPolicy）`,
    );
  return mergeGeneric(ctx, pair);
};

/** 合并对象的单个 key（决定走 override policy / 命名字段表 / 通用递归）。 */
const mergeKey = (
  ctx: MergeCtx,
  arg: { parentPointer: string; key: string; base: Json; patch: Json },
): Json => {
  const { parentPointer, key } = arg;
  const pointer = childPointer(parentPointer, key);
  const next: MergePair = { pointer, base: arg.base, patch: arg.patch };
  const override = ctx.opts.fieldPolicy?.[pointer];
  if (override) return applyOverridePolicy(ctx, next, override);
  // 仅顶层（parent 为根）字段套用 package.json 专用命名表
  if (parentPointer === "") return mergeNamedField(ctx, key, next);
  return mergeGeneric(ctx, next);
};

/** 通用合并：对象递归 / 标量异值冲突 / 数组（白名单外）异值冲突 / 类型不符冲突。 */
const mergeGeneric = (ctx: MergeCtx, pair: MergePair): Json => {
  const { pointer, base, patch } = pair;
  if (isObject(base) && isObject(patch)) {
    const out: JsonObject = { ...base };
    for (const key of Object.keys(patch)) {
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        out[key] = mergeKey(ctx, {
          parentPointer: pointer,
          key,
          base: out[key],
          patch: patch[key],
        });
      } else {
        out[key] = patch[key];
      }
    }
    return out;
  }
  const loc = pointer || "(root)";
  // 类型不符（一侧 object 一侧非）→ 冲突
  if (isObject(base) !== isObject(patch))
    return conflictIfUnequal(
      ctx,
      pair,
      `类型不符冲突：${loc} 既有 ${JSON.stringify(base)} 又有 ${JSON.stringify(patch)}`,
    );
  // 数组（白名单外）：相等保留 / 异值冲突
  if (Array.isArray(base) || Array.isArray(patch))
    return conflictIfUnequal(
      ctx,
      pair,
      `数组异值冲突（非白名单字段，不静默拼接/替换）：${loc}`,
    );
  // 标量：相等保留 / 异值冲突
  return conflictIfUnequal(
    ctx,
    pair,
    `标量异值冲突：${loc} 既有 ${JSON.stringify(base)} 又有 ${JSON.stringify(patch)}`,
  );
};

/**
 * 合并 base + patch（package.json 专用策略表，D-H8）。
 * 返回 {result, conflicts}；冲突由调用方填 file 后经 assertNoConflict throw。
 */
export const jsonMerge = (
  base: unknown,
  patch: unknown,
  opts: JsonMergeOptions,
): JsonMergeResult => {
  const ctx: MergeCtx = { conflicts: [], opts };
  const result = mergeGeneric(ctx, { pointer: "", base, patch });
  return { result, conflicts: ctx.conflicts };
};

/**
 * 冲突非空则 throw（L2：统一复用 conflict.ts 的 assertNoConflicts 唯一断言入口，
 * 不再自造第二套格式）。保留此命名导出向后兼容（测试 / 调用方）。
 */
export const assertNoConflict = assertNoConflicts;

// ───────────────────────── 确定性序列化（[MUST NOT] 全局排序 key） ─────────────────────────

export interface JsonStyle {
  /** 缩进空格数（默认 2） */
  indent: number;
  /** 行尾（默认 LF） */
  eol: "\n" | "\r\n";
}

/**
 * 探测既有 JSON 文本风格（缩进空格数 + EOL）。
 * EOL 复用 cli-template detectEol；缩进取首个缩进行的前导空格数。
 */
export const detectJsonStyle = (text: string): JsonStyle => {
  const eol = detectEol(text);
  // 找首个缩进行（以空格起头、非纯空白）推断缩进单位
  const lines = text.split(/\r?\n/);
  let indent = 2;
  for (const line of lines) {
    const m = /^( +)\S/.exec(line);
    if (m) {
      indent = m[1].length;
      break;
    }
  }
  return { indent, eol };
};

/**
 * 确定性序列化：保留对象 key 插入顺序（[MUST NOT] 全局排序），缩进/EOL 可配。
 * 默认 2 空格 + LF + 末换行。
 */
export const stringifyJsonDeterministic = (
  obj: unknown,
  opts?: { indent?: number; eol?: "\n" | "\r\n" },
): string => {
  const indent = opts?.indent ?? 2;
  const eol = opts?.eol ?? "\n";
  // JSON.stringify 保留对象 key 插入顺序（不排序）
  let out = JSON.stringify(obj, null, indent);
  if (eol === "\r\n") out = out.replace(/\n/g, "\r\n");
  return out + eol;
};
