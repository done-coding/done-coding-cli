import pinyin from "pinyin";
import { execSync } from "node:child_process";
import { log } from "./log";

/** 获取git最好提交信息参数 */
export interface GetGitLastCommitParams {
  /**
   * 远程仓库别名
   */
  remoteAlias?: string;
}

/** 远程仓库信息 */
export interface GitRemoteInfo {
  /**
   * 远程仓库别名
   */
  alias?: GetGitLastCommitParams["remoteAlias"];
  /**
   * 仓库地址
   */
  url?: string;
}

/**
 * git最后提交信息
 */
export interface GitLastCommitInfo {
  /**
   * 最后一次提交hash值
   */
  lastHash: string;
  /**
   * 最后一次提交者
   */
  lastCommitter: string;
  /**
   * 最后一次提交者拼音
   */
  lastCommitterPinYin: string;
  /**
   * 最后一次提交者邮箱
   */
  lastCommitEmail: string;
  /**
   * 最后一次提交信息
   */
  lastCommitMsg: string;
  /**
   * 用户名
   */
  userName: string;
  /**
   * 用户名拼音
   */
  userNamePinYin: string;
  /**
   * 邮箱
   */
  userEmail: string;
  /**
   * 分知名
   */
  branchName: string;
  /** 远程仓库信息 */
  remoteInfo?: GitRemoteInfo;
}

/**
 * 获取git 最后提交信息
 */
export const getGitLastCommitInfo = ({
  remoteAlias,
}: GetGitLastCommitParams = {}): GitLastCommitInfo => {
  try {
    const lastHash = execSync(`git rev-parse HEAD`).toString().trim();
    const lastCommitter = execSync('git log -1 --pretty=format:"%an"')
      .toString()
      .trim();
    const lastCommitEmail = execSync('git log -1 --pretty=format:"%ae"')
      .toString()
      .trim();
    const lastCommitMsg = execSync('git log -1 --pretty=format:"%s"')
      .toString()
      .trim();
    const userName = execSync("git config user.name").toString().trim();
    const userEmail = execSync("git config user.email").toString().trim();
    const branchName = execSync("git rev-parse --abbrev-ref HEAD")
      .toString()
      .trim();
    let remoteUrl = "";
    try {
      remoteUrl = execSync(`git config --get remote.${remoteAlias}.url`)
        .toString()
        .trim();
    } catch (e) {
      log.warn(`git远程仓库地址获取失败或者不存在`);
    }

    return {
      lastHash,
      lastCommitter,
      lastCommitterPinYin: pinyin(lastCommitter, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      }).join(""),
      lastCommitEmail,
      lastCommitMsg,
      userName,
      userNamePinYin: pinyin(userName, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      }).join(""),
      userEmail,
      branchName,
      remoteInfo: remoteUrl
        ? {
            alias: remoteAlias,
            url: remoteUrl,
          }
        : undefined,
    };
  } catch (err) {
    log.error(`获取git最后提交信息失败`);
    throw err;
  }
};

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
