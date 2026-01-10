/** 是http git地址 */
export const isHttpGitUrl = (url: string) => {
  return /^https?:\/\//.test(url);
};

/** 是 ssh git地址 */
export const isSshGitUrl = (url: string) => {
  return /^git@/.test(url);
};

/** http 地址 转换为 ssh 地址 */
export const http2sshGitUrl = (httpUrl: string) => {
  const { hostname, pathname } = new URL(httpUrl);
  return `git@${hostname}:${pathname.replace("/", "")}`;
};
