import chalk from "chalk";
import { GitPlatformEnum, type Options } from "./types";
import { getGiteeUserGitRepos } from "@/api/gitee";
import { getGithubUserGitRepos } from "@/api/github";
import prompts from "prompts";
import { execSync } from "node:child_process";

export const clone = async (options: Options) => {
  const { platform, username } = options;
  let repos: {
    name: string;
    httpUrl: string;
    sshUrl: string;
    description: string;
  }[] = [];

  console.log(chalk.blue(`正在获取${username}的${platform}仓库列表...`));
  switch (options.platform) {
    case GitPlatformEnum.GITHUB: {
      repos = (await getGithubUserGitRepos(username)).data.map((item) => {
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
      repos = (await getGiteeUserGitRepos(username)).data.map((item) => {
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
      console.log(chalk.red(`未知平台${platform}`));
      return process.exit(1);
    }
  }

  console.log(chalk.green(`获取${username}的${platform}仓库列表成功`));
  console.log(repos);

  if (repos.length === 0) {
    console.log(chalk.yellow(`${username} 可获取${platform}仓库列表为空`));
    return;
  }

  const { repo } = await prompts({
    name: "repo",
    type: "select",
    message: "选择一个仓库来克隆",
    choices: repos.map((item) => {
      return {
        title: item.name,
        value: item.sshUrl,
      };
    }),
  });

  execSync(`git clone ${repo} 1>&2`);

  console.log(chalk.green(`克隆${repo}成功`));
};
