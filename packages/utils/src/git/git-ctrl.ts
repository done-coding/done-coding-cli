import { removeAssetAsync } from "@/file-operate";
import path from "node:path";

/**
 * 获取git路径
 * ---
 * @param projectPath 项目路径
 */
export const getGitPath = (projectPath: string) => {
  return path.resolve(projectPath, ".git");
};

/**
 * 移除git控制 - 异步
 * @param projectPath
 * @returns
 */
export const rmGitCtrlAsync = (projectPath: string) => {
  return removeAssetAsync(getGitPath(projectPath));
};
