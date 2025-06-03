import { githubRequest } from "./_request";

/** 获取 github 仓库信息 */
export interface GithubRepoInfo {
  /** 仓库名 */
  name: string;
  /** ssh */
  ssh_url: string;
  /** https */
  clone_url: string;
  /** 描述 */
  description?: string | null;
}

/** 获取 github 用户公开仓库列表 */
export const getGithubUserPublicRepos = ({
  username,
}: {
  username: string;
  accessToken?: string;
}) => {
  return githubRequest<GithubRepoInfo[]>({
    url: `/users/${username}/repos`,
    method: "GET",
  });
};

/** 获取 github 用户所有仓库列表 */
export const getGithubUserAllRepos = ({
  accessToken,
}: {
  username: string;
  accessToken?: string;
}) => {
  return githubRequest<GithubRepoInfo[]>({
    url: `/user/repos`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      per_page: 100,
      page: 1,
      sort: "updated",
    },
  });
};
