import { GitPlatformEnum, type Options } from "./types";
import { getGiteeUserAllRepos, getGiteeUserPublicRepos } from "@/api/gitee";
import { getGithubUserPublicRepos } from "@/api/github";
import { getGitConfigInfo } from "./config";
import { log, xPrompts } from "@done-coding/cli-utils";

/** 获取目标仓库地址 */
export const getTargetRepoUrl = async ({
  platform: platformInit,
  username: usernameInit,
}: Partial<Options> = {}) => {
  const options: Options = {
    platform: platformInit!,
    username: usernameInit!,
  };
  if (!platformInit) {
    /** git平台选择 */
    const gitPlatformChoices = [
      { title: "GitHub", value: GitPlatformEnum.GITHUB },
      { title: "Gitee", value: GitPlatformEnum.GITEE },
    ];
    options.platform = (
      await xPrompts({
        type: "select",
        name: "platform",
        message: "选择git平台",
        choices: gitPlatformChoices,
      })
    ).platform as GitPlatformEnum;
  }
  if (!usernameInit) {
    options.username = (
      await xPrompts({
        type: "text",
        name: "username",
        message: "请输入用户名",
        format: (value) => value.trim(),
        validate: (value) => value.length > 0 || "用户名不能为空",
      })
    ).username;
  }

  const { platform, username } = options;

  let repos: {
    name: string;
    httpUrl: string;
    sshUrl: string;
    description: string;
  }[] = [];

  const gitInfo = getGitConfigInfo({
    secretKey: username,
    platform,
  });

  let accessToken = gitInfo?.accessToken;

  log.stage(`正在获取${username}的${platform}仓库列表...`);

  const params = {
    username,
    accessToken,
  };
  switch (options.platform) {
    case GitPlatformEnum.GITHUB: {
      repos = (await getGithubUserPublicRepos(params)).data.map((item) => {
        return {
          name: item.name,
          httpUrl: item.clone_url,
          sshUrl: item.ssh_url,
          description: item.description || "",
        };
      });
      break;
    }
    case GitPlatformEnum.GITEE: {
      repos = (
        await (params.accessToken
          ? getGiteeUserAllRepos
          : getGiteeUserPublicRepos)(params)
      ).data.map((item) => {
        return {
          name: item.name,
          httpUrl: item.html_url,
          sshUrl: item.ssh_url,
          description: item.description || "",
        };
      });
      break;
    }
    default: {
      log.error(`未知平台${platform}`);
      return process.exit(1);
    }
  }

  log.success(`获取${username}的${platform}仓库列表成功`);
  // console.log(repos.map((item) => item.name));

  if (repos.length === 0) {
    log.warn(`${username} 可获取${platform}仓库列表为空`);
    return;
  } else {
    log.stage(`共${repos.length}个仓库`);
  }

  const { repoUrl } = await xPrompts({
    name: "repoUrl",
    type: "select",
    message: "选择仓库",
    choices: repos.map((item) => {
      return {
        title: `${item.name} ${item.description}`,
        value: item.sshUrl,
      };
    }),
  });

  return repoUrl;
};
