import { execSyncWithLogDispatch } from "@/process";

/** 获取git项目目录 */
export const getGitProjectDir = (rootDir: string) => {
  const bufferRes = execSyncWithLogDispatch("git rev-parse --show-toplevel", {
    cwd: rootDir,
  });
  const strRes = bufferRes.toString();

  if (!strRes) {
    throw new Error("获取git根目录失败");
  }

  return strRes.trim();
};
