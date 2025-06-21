import { log } from "@/log";
import { execSync } from "node:child_process";

/** 获取当前分支名 */
export const getCurrentBranchName = (): string | undefined => {
  try {
    const bufferRes = execSync("git symbolic-ref --short HEAD", {
      stdio: "ignore",
    });

    const branchName = bufferRes?.toString()?.trim();

    return branchName;
  } catch (error) {
    try {
      const headVersion = execSync("git rev-parse --short HEAD")
        .toString()
        .trim();
      log.skip(`当前未指向具体某个分支, 当前commit hash: ${headVersion}`);
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return undefined;
    }
  }
};
