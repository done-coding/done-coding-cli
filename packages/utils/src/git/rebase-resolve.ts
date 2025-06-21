import path from "node:path";
import fs from "node:fs";
import { getGitProjectDir } from "./base-info-resolve";

/** 检测当前正在变基 */
export const checkCurrentIsRebasing = (rootDir: string) => {
  const projectDir = getGitProjectDir(rootDir);
  const gitDir = path.resolve(projectDir, ".git");
  const rebaseMergePath = path.resolve(gitDir, "rebase-merge");
  if (fs.existsSync(rebaseMergePath)) {
    return true;
  }
  const rebaseApplyPath = path.resolve(gitDir, "rebase-apply");
  if (fs.existsSync(rebaseApplyPath)) {
    return true;
  }
  const rebaseHeadPath = path.resolve(gitDir, "REBASE_HEAD");
  if (fs.existsSync(rebaseHeadPath)) {
    return true;
  }
  return false;
};
