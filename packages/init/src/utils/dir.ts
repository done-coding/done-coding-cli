import path from "node:path";
import fs from "node:fs";

export const lookForParentTargetDir = (
  targetDir: string,
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
    const currentNamespaceDir = path.join(dir, targetDir);
    if (fs.existsSync(currentNamespaceDir)) {
      return dir;
    }
  }
};
