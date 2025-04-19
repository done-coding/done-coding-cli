import { giteeRequest } from "./_request";

/** 获取 gitee 用户公开的仓库列表 */
export const getGiteeUserPublicRepos = ({
  username,
}: {
  username: string;
  accessToken?: string;
}) => {
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

/** 获取 gitee 用户的所有仓库列表 */
export const getGiteeUserAllRepos = ({
  accessToken,
}: {
  username: string;
  accessToken?: string;
}) => {
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
    url: `/api/v5/user/repos`,
    method: "GET",
    params: {
      access_token: accessToken,
      per_page: 100,
      page: 1,
      sort: "updated",
    },
  });
};
