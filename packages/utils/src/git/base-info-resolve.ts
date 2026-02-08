/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-21 19:24:27
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 12:41:39
 */
import { execSyncHijack } from "@/process";

/** 获取git项目目录 */
export const getGitProjectDir = (rootDir: string) => {
  const bufferRes = execSyncHijack("git rev-parse --show-toplevel", {
    cwd: rootDir,
  });
  const strRes = bufferRes.toString();

  if (!strRes) {
    throw new Error("获取git根目录失败");
  }

  return strRes.trim();
};
