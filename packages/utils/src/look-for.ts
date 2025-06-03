import path from "node:path";
import fs from "node:fs";
// import { log } from "./log";

/**
 * 查找目标文件或目录
 */
export const lookForParentTarget = (
  /** 目标文件或目录 */
  target: string,
  {
    /** 当前目录 */
    currentDir = process.cwd(),
    /** 优先找最远的父目录 */
    isFindFarthest = true,
  }: {
    currentDir?: string;
    isFindFarthest?: boolean;
  } = {},
): string | undefined => {
  const dirList = path
    .resolve(currentDir)
    .split(path.sep)
    .map((dir, index, arr) => {
      if (index) {
        return path.join(arr.slice(0, index).join(path.sep), dir);
      } else {
        return dir;
      }
    });

  while (dirList.length) {
    const dir = isFindFarthest ? dirList.shift()! : dirList.pop()!;
    const currentNamespaceDir = path.join(dir, target);
    if (fs.existsSync(currentNamespaceDir)) {
      // log.info(`${currentNamespaceDir}存在`);
      return dir;
      // } else {
      // log.info(`${currentNamespaceDir}不存在`)
    }
  }

  return undefined;
};
