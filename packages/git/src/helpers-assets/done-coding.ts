/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-18 20:46:25
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:47:16
 */
import { cloneHandler } from "@/handlers";
import { GitPlatformEnum } from "@/types";
import { getGitUsernameForm, getPlatformForm } from "@/utils";
import { outputConsole, xPrompts } from "@done-coding/cli-utils";

/** 克隆done-coding系列项目 */
export const cloneDoneCodingSeries = async (projectName?: string) => {
  outputConsole.info("克隆done-coding系列项目");

  outputConsole.stage("选择平台:");
  const { platform } = await xPrompts(getPlatformForm(GitPlatformEnum.GITEE));

  outputConsole.stage("选择用户名:");
  const { username } = await xPrompts(
    getGitUsernameForm(
      {
        [GitPlatformEnum.GITHUB]: "done-coding",
        [GitPlatformEnum.GITEE]: "justsosu",
      }[platform as GitPlatformEnum],
    ),
  );

  outputConsole.info("platform:", platform);
  outputConsole.info("username:", username);

  await cloneHandler({
    platform,
    username,
    projectName,
  });
};
