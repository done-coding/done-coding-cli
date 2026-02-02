/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-05-31 19:29:11
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:38:09
 */
import path from "node:path";
import fs from "node:fs";

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
      const preDirList = arr.slice(0, index);
      const currentDirList = preDirList.concat(dir);
      const currentDirPath = currentDirList.join(path.sep);
      const res = currentDirPath || path.sep;
      return res;
    });

  while (dirList.length) {
    const dir = isFindFarthest ? dirList.shift()! : dirList.pop()!;
    const currentNamespaceDir = path.join(dir, target);
    if (fs.existsSync(currentNamespaceDir)) {
      return dir;
    }
  }

  return undefined;
};
