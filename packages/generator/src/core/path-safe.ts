/**
 * 路径包含判定 + realpath 容错（DRY：收敛 batch-discovery/instance-dir/vfs/engine/render 的
 * 私有 isInside 复制；realpathOrResolve 收敛 batch-discovery/discover 的私有复制）。
 *
 * 语义 = 词法包含判定（非 realpath）：child === parent 或 child 以 parent + 路径分隔符 开头。
 * 需 symlink 逃逸防护的调用方 [MUST] 自行先 realpath 输入（batch-discovery/instance-dir 已传
 * real* 路径；engine/vfs/render 传 path.resolve 路径、同基相对包含语义保持）。
 */
import fs from "node:fs";
import path from "node:path";

export const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/** realpath 容错（路径不存在时回落 resolve 后字面量，越界校验 / 读边界基准用前缀比较即可） */
export const realpathOrResolve = (p: string): string => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};
