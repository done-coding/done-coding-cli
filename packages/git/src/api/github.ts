import { githubRequest } from "./_request";

/** 获取 github 用户公开仓库列表 */
export const getGithubUserPublicRepos = ({
  username,
}: {
  username: string;
  accessToken?: string;
}) => {
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
