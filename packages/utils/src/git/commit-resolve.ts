import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getGitProjectDir } from "./base-info-resolve";
import { HooksNameEnum } from "@/husky";
import type { GitRemoteInfo } from "./remote-operate";
import { outputConsole } from "@/env-config";
import pinyin from "pinyin";
import { execSync } from "node:child_process";

/** 支持通过提交钩子获取提交信息的 */
export const SUPPORT_GET_COMMIT_BY_HOOKS_NAMES = [
  // HooksNameEnum.PRE_MERGE_COMMIT,
  HooksNameEnum.PREPARE_COMMIT_MSG,
  HooksNameEnum.COMMIT_MSG,
] as const;

// 获取数组中单项的联合类型
export type SupportGetCommitByHookName =
  (typeof SUPPORT_GET_COMMIT_BY_HOOKS_NAMES)[number];

/** 根据hookName获取(将)提交的信息 */
export const getCommitByHookName = ({
  hookName,
  rootDir,
}: {
  hookName: SupportGetCommitByHookName;
  rootDir: string;
}): string => {
  const projectDir = getGitProjectDir(rootDir);
  const gitDir = path.resolve(projectDir, ".git");
  switch (hookName) {
    case HooksNameEnum.PREPARE_COMMIT_MSG:
    case HooksNameEnum.COMMIT_MSG: {
      const filePath = path.resolve(gitDir, "MERGE_MSG");
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf-8");
      }
    }
  }

  return "";
};

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

/** 获取git最好提交信息参数 */
export interface GetGitLastCommitParams {
  /**
   * 远程仓库别名
   */
  remoteAlias?: GitRemoteInfo["alias"];
}

/**
 * 获取git 最后提交信息
 */
export const getGitLastCommitInfo = ({
  remoteAlias = "origin",
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
      outputConsole.warn(`git远程仓库地址获取失败或者不存在`);
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
    outputConsole.error(`获取git最后提交信息失败`);
    throw err;
  }
};
