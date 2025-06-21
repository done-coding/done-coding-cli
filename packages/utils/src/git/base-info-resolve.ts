import { execSync } from "node:child_process";

/** 获取git项目目录 */
export const getGitProjectDir = (rootDir: string) => {
  const bufferRes = execSync("git rev-parse --show-toplevel", {
    cwd: rootDir,
  });
  const strRes = bufferRes.toString();

  if (!strRes) {
    throw new Error("获取git根目录失败");
  }

  return strRes.trim();
};
