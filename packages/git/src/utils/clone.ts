import type { Options } from "./types";
import { getTargetRepoUrl } from "./get-repo";
import { execSync } from "node:child_process";
import { log } from "@done-coding/cli-utils";

/** 克隆目标仓库 */
export const gitClone = async (options: Options) => {
  const repoUrl = await getTargetRepoUrl(options);

  execSync(`git clone ${repoUrl} 1>&2`);

  log.success(`克隆${repoUrl}成功`);
};
