import { githubRequest } from "./_request";

export const getGithubUserGitRepos = (username: string) => {
  return githubRequest<
    {
      /** 仓库名 */
      name: string;
      /** ssh */
      ssh_url: string;
      /** https */
      clone_url: string;
      /** 描述 */
      description?: string | null;
    }[]
  >({
    url: `/users/${username}/repos`,
    method: "GET",
  });
};
