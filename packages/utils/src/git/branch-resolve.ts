/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-21 19:27:13
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 12:41:28
 */
import { outputConsole } from "@/env-config";
import { execSyncHijack } from "@/process";

/** 获取当前分支名 */
export const getCurrentBranchName = (): string | undefined => {
  try {
    const bufferRes = execSyncHijack("git symbolic-ref --short HEAD", {
      stdio: "ignore",
    });

    const branchName = bufferRes?.toString()?.trim();

    return branchName;
  } catch (error) {
    try {
      const headVersion = execSyncHijack("git rev-parse --short HEAD")
        .toString()
        .trim();
      outputConsole.skip(
        `当前未指向具体某个分支, 当前commit hash: ${headVersion}`,
      );
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return undefined;
    }
  }
};
