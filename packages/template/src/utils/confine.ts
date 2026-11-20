/**
 * 受限编译：读写目标解开符号链接后须在 rootDir 内。
 * ---
 * 供模板内容不可信的调用方（create 编译从模板仓拷来的项目）显式开启；缺省不开，
 * `dc template` 等既有用法行为不变。判定在任何读写 / 建目录之前做。
 */
import { pathIsInsideParentDir } from "@done-coding/cli-utils";
import fs from "node:fs";
import path from "node:path";

/** 解链接层数上限（防链接成环） */
const MAX_LINK_DEPTH = 40;

/**
 * 解开符号链接后的真实路径。
 * 路径尚不存在时按最近的已存在祖先的真实路径 + 余下各段推算；末段是悬空链接时按链接文本继续解
 * （写入会穿过悬空链接在链接目标处建文件，不能当成「不存在」放过）。
 */
export const resolveRealPath = (target: string, depth = 0): string => {
  if (depth > MAX_LINK_DEPTH) {
    throw new Error(`符号链接层数过多，疑似成环：${target}`);
  }
  try {
    return fs.realpathSync(target);
  } catch (error) {
    const parent = path.dirname(target);
    if (parent === target) throw error;
    const candidate = path.join(
      resolveRealPath(parent, depth + 1),
      path.basename(target),
    );
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(candidate);
    } catch {
      return candidate;
    }
    return stat.isSymbolicLink()
      ? resolveRealPath(
          path.resolve(path.dirname(candidate), fs.readlinkSync(candidate)),
          depth + 1,
        )
      : candidate;
  }
};

/** 目标（相对 rootDir 解析、解开链接后）须在 rootDir 内，否则拒绝；rootLabel 为报错里对 rootDir 的称呼 */
export const assertInsideRootDir = ({
  rootDir,
  target,
  label,
  rootLabel = "项目目录",
}: {
  rootDir: string;
  /** 相对 rootDir 或绝对路径 */
  target: string;
  /** 报错里对目标的称呼 */
  label: string;
  rootLabel?: string;
}) => {
  const root = fs.realpathSync(rootDir);
  const real = resolveRealPath(path.resolve(rootDir, target));
  if (!pathIsInsideParentDir({ targetPath: real, parentDir: root })) {
    throw new Error(
      `${label} ${target} 指向 ${real}，越出${rootLabel} ${root}，已拒绝`,
    );
  }
};
