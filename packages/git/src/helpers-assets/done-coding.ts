import { cloneHandler } from "@/handlers";
import { GitPlatformEnum } from "@/types";
import { getGitUsernameForm, getPlatformForm } from "@/utils";
import { log, xPrompts } from "@done-coding/cli-utils";

/** 克隆done-coding系列项目 */
export const cloneDoneCodingSeries = async (projectName?: string) => {
  log.info("克隆done-coding系列项目");

  log.stage("选择平台:");
  const { platform } = await xPrompts(getPlatformForm(GitPlatformEnum.GITEE));

  log.stage("选择用户名:");
  const { username } = await xPrompts(
    getGitUsernameForm(
      {
        [GitPlatformEnum.GITHUB]: "done-coding",
        [GitPlatformEnum.GITEE]: "justsosu",
      }[platform as GitPlatformEnum],
    ),
  );

  log.info("platform:", platform);
  log.info("username:", username);

  await cloneHandler({
    platform,
    username,
    projectName,
  });
};
