import { giteeRequest } from "./_request";

export const getGiteeUserGitRepos = (username: string) => {
  return giteeRequest<
    {
      /** 仓库名 */
      name: string;
      /** ssh */
      ssh_url: string;
      /** https */
      html_url: string;
      /** 描述 */
      description?: string | null;
    }[]
  >({
    url: `/api/v5/users/${username}/repos`,
    method: "GET",
  });
};
