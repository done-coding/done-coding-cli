import { GitPlatformEnum, type CloneOptions } from "./types";
import { getTargetRepoUrl } from "./get-repo";
import { execSync } from "node:child_process";
import type { CliInfo } from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";

/** 获取克隆命令的位置参数 */
export const getClonePositionals = (): CliInfo["positionals"] => {
  return {
    platform: {
      describe: "选择git平台",
      type: "string",
      choices: [GitPlatformEnum.GITHUB, GitPlatformEnum.GITEE],
    },
    username: {
      describe: "git平台用户名",
      type: "string",
    },
  };
};

/** 克隆目标仓库 */
export const cloneHandler = async (options: CloneOptions) => {
  const repoUrl = await getTargetRepoUrl(options);

  execSync(`git clone ${repoUrl}`, {
    stdio: "inherit",
  });

  log.success(`克隆${repoUrl}成功`);
};
