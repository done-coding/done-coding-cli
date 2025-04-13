import path from "node:path";
import fs from "node:fs";

/**
 * 查找目标文件或目录
 * @param target 目标文件或目录
 * @param currentDir 当前目录
 * @returns 目标文件或目录路径
 */
export const lookForParentTarget = (
  target: string,
  currentDir: string = process.cwd(),
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
    const dir = dirList.pop()!;
    const currentNamespaceDir = path.join(dir, target);
    if (fs.existsSync(currentNamespaceDir)) {
      return currentNamespaceDir;
    }
  }

  return undefined;
};
