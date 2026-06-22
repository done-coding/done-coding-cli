/**
 * RFC 6901 JSON Pointer 读 / 查 / 删（deleteField op 用，design §3.1 / D-H5 / C5）。
 *
 *  - 转义：`~1` → `/`、`~0` → `~`（先 ~1 后 ~0，RFC 6901 §4 顺序）。
 *  - 根指针 `""` 指向整个文档；数组索引按数字解析。
 *  - 删除 pointer 不存在 [MUST] throw（[MUST NOT] 静默，D-H5/C5）。
 */

/** 解码单个 reference token（`~1`→`/`，`~0`→`~`，顺序敏感，RFC 6901 §4） */
const decodeToken = (token: string): string =>
  token.replace(/~1/g, "/").replace(/~0/g, "~");

/**
 * 解析 JSON Pointer 字符串为 reference token 数组。
 * 根 `""` → `[]`；非空 [MUST] 以 `/` 起头，否则非法 throw。
 */
export const parsePointer = (pointer: string): string[] => {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new Error(
      `非法 JSON Pointer（非空必须以 "/" 起头）：${JSON.stringify(pointer)}`,
    );
  }
  return pointer.slice(1).split("/").map(decodeToken);
};

/** 判定值是否为可索引容器（object 或 array，排除 null） */
const isContainer = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * 按 pointer 读取（不存在返回 undefined，不 throw）。
 * 根 `""` 返回 obj 自身。
 */
export const getByPointer = (obj: unknown, pointer: string): unknown => {
  const tokens = parsePointer(pointer);
  let cur: unknown = obj;
  for (const token of tokens) {
    if (!isContainer(cur)) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length)
        return undefined;
      cur = cur[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, token)) return undefined;
      cur = (cur as Record<string, unknown>)[token];
    }
  }
  return cur;
};

/** 判定 pointer 是否存在（含值为 undefined 但 key 存在的情形按存在算） */
export const hasPointer = (obj: unknown, pointer: string): boolean => {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) return true; // 根恒存在
  let cur: unknown = obj;
  for (const token of tokens) {
    if (!isContainer(cur)) return false;
    if (Array.isArray(cur)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return false;
      cur = cur[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(cur, token)) return false;
      cur = (cur as Record<string, unknown>)[token];
    }
  }
  return true;
};

/**
 * 按 pointer 原地删除（[MUST] 不存在则 throw，D-H5/C5）。
 * 根 `""` 不可删（throw）；数组用 splice 保序删除。
 */
export const deleteByPointer = (obj: unknown, pointer: string): void => {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) {
    throw new Error('无法删除根指针 ""（JSON Pointer 根不可删）');
  }
  // 定位父容器
  let parent: unknown = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (!isContainer(parent)) {
      throw new Error(
        `JSON Pointer 路径不存在（中途遇非容器）：${JSON.stringify(pointer)}`,
      );
    }
    if (Array.isArray(parent)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
        throw new Error(
          `JSON Pointer 数组索引越界：${JSON.stringify(pointer)} @ "${token}"`,
        );
      }
      parent = parent[idx];
    } else {
      if (!Object.prototype.hasOwnProperty.call(parent, token)) {
        throw new Error(
          `JSON Pointer 路径不存在：${JSON.stringify(pointer)} @ "${token}"`,
        );
      }
      parent = (parent as Record<string, unknown>)[token];
    }
  }

  const last = tokens[tokens.length - 1];
  if (!isContainer(parent)) {
    throw new Error(
      `JSON Pointer 父节点非容器，无法删除：${JSON.stringify(pointer)}`,
    );
  }
  if (Array.isArray(parent)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new Error(
        `JSON Pointer 数组索引不存在，无法删除：${JSON.stringify(pointer)} @ "${last}"`,
      );
    }
    parent.splice(idx, 1);
  } else {
    if (!Object.prototype.hasOwnProperty.call(parent, last)) {
      throw new Error(
        `JSON Pointer 目标不存在，无法删除：${JSON.stringify(pointer)} @ "${last}"`,
      );
    }
    delete (parent as Record<string, unknown>)[last];
  }
};
