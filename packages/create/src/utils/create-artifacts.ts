import { existsSync, realpathSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathIsInsideParentDir, readConfigFile } from "@done-coding/cli-utils";
import { assertInsideRootDir } from "@done-coding/cli-template";

/** 严格位于 parent 内（不含 parent 本身）；调用方先 realpath 双解，拒绝 symlink 逃逸。 */
const isStrictlyInside = (parentDir: string, targetPath: string) =>
  pathIsInsideParentDir({ targetPath, parentDir });

/** 仅删除 rootDir 内的空父目录，保留其他 CLI 配置与并行草稿。 */
export const cleanupCreateDraftParents = (rootDir: string) => {
  const root = realpathSync(rootDir);
  if (root === path.parse(root).root || root === realpathSync(homedir()))
    return;
  const stop = path.resolve(rootDir, ".done-coding");
  let current = path.resolve(stop, "default/tmp/create");
  while (current === stop || isStrictlyInside(stop, current)) {
    if (existsSync(current)) {
      const realCurrent = realpathSync(current);
      if (!isStrictlyInside(root, realCurrent)) return;
      try {
        rmdirSync(current);
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code === "ENOTEMPTY" ||
          (error as NodeJS.ErrnoException).code === "EEXIST"
        )
          return;
        throw error;
      }
    }
    if (current === stop) return;
    current = path.dirname(current);
  }
};

/**
 * 读模板配置（预设问题 / 使用步骤）。
 * 模板内容不可信：读前确认配置文件解开符号链接后仍在项目目录内，不让链接把本机文件读进来。
 */
export const readTemplateConfig = <T>(options: {
  rootDir: string;
  configPath: string;
}): Promise<T> => {
  assertInsideRootDir({
    rootDir: options.rootDir,
    target: options.configPath,
    label: "模板配置",
  });
  return readConfigFile<T>(options);
};
