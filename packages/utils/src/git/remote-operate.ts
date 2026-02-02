import { execSync } from "node:child_process";
/** 远程仓库信息 */
export interface GitRemoteInfo {
  /**
   * 远程仓库别名
   */
  alias?: string;
  /**
   * 仓库地址
   */
  url?: string;
}

/** 推送git发布信息到远程仓库 */
export const pushGitPublishInfoToRemote = ({
  branchName,
  version,
  remoteInfo,
}: {
  branchName: string;
  version: string;
  remoteInfo?: GitRemoteInfo;
}) => {
  if (remoteInfo) {
    execSync(`git push ${remoteInfo.alias} v${version}`, {
      stdio: "inherit",
    });
    execSync(`git push ${remoteInfo.alias} ${branchName}`, {
      stdio: "inherit",
    });
  }
};
