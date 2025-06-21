import { cloneHandler } from "@/handlers";
import { GitPlatformEnum } from "@/types";
import { getGitUsernameForm, getPlatformForm } from "@/utils";
import { xPrompts } from "@done-coding/cli-utils";

/** 克隆done-coding系列项目 */
export const cloneDoneCodingSeries = async (projectName?: string) => {
  console.log("克隆done-coding系列项目");

  console.log("选择平台:");
  const { platform } = await xPrompts(getPlatformForm(GitPlatformEnum.GITEE));

  console.log("选择用户名:");
  const { username } = await xPrompts(
    getGitUsernameForm(
      {
        [GitPlatformEnum.GITHUB]: "done-coding",
        [GitPlatformEnum.GITEE]: "justsosu",
      }[platform as GitPlatformEnum],
    ),
  );

  console.log("platform:", platform);
  console.log("username:", username);

  await cloneHandler({
    platform,
    username,
    projectName,
  });
};
