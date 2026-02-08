/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-02-07 19:21:19
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 12:40:22
 */
import { execSyncHijack } from "@/process";
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
    execSyncHijack(`git push ${remoteInfo.alias} v${version}`, {
      stdio: "inherit",
    });
    execSyncHijack(`git push ${remoteInfo.alias} ${branchName}`, {
      stdio: "inherit",
    });
  }
};
