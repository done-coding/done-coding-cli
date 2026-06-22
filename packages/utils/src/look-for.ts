/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-05-31 19:29:11
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:38:09
 */
import path from "node:path";
import fs from "node:fs";
import { safeCwd } from "@/safe-cwd";

/**
 * 构造从根到 `currentDir` 的祖先目录链（含 currentDir 自身）。
 * ---
 * 数组**由远及近**（index 0 = 文件系统根 / 最远祖先，末项 = currentDir 本身）。
 * 抽出此原语供 `lookForParentTarget` 与 `dir-resolver`
 * 复用同一套「逐级父目录」遍历逻辑，避免重复封装。
 */
export const buildAncestorDirList = (
  currentDir: string = safeCwd(),
): string[] =>
  path
    .resolve(currentDir)
    .split(path.sep)
    .map((dir, index, arr) => {
      const preDirList = arr.slice(0, index);
      const currentDirList = preDirList.concat(dir);
      const currentDirPath = currentDirList.join(path.sep);
      const res = currentDirPath || path.sep;
      return res;
    });

/**
 * 查找目标文件或目录
 */
export const lookForParentTarget = (
  /** 目标文件或目录 */
  target: string,
  {
    /** 当前目录 */
    currentDir = safeCwd(),
    /** 优先找最远的父目录 */
    isFindFarthest = true,
  }: {
    currentDir?: string;
    isFindFarthest?: boolean;
  } = {},
): string | undefined => {
  const dirList = buildAncestorDirList(currentDir);

  while (dirList.length) {
    const dir = isFindFarthest ? dirList.shift()! : dirList.pop()!;
    const currentNamespaceDir = path.join(dir, target);
    if (fs.existsSync(currentNamespaceDir)) {
      return dir;
    }
  }

  return undefined;
};
