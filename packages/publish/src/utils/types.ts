import type { PublishTagEnum, PublishVersionTypeEnum } from "./enums";
/**
 * git仓库信息
 */
export interface GitInfo {
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
  /**
   * 仓库地址
   */
  remoteUrl: string;
}

/**
 * npm信息
 */
export interface NpmInfo {
  /**
   * 正式包名
   */
  name: string;
  /**
   * 当前版本号
   */
  version: string;
  /**
   * 标签
   */
  tag: PublishTagEnum;
}

/**
 * 配置信息
 */
export interface ConfigInfo {
  /**
   * web构建命令
   */
  webBuild: string;
  /**
   * git远程仓库名
   */
  gitOriginName: string;
}

/** 发布模式 */
export enum PublishModeEnum {
  /** npm发布模式 */
  NPM = "npm",
  /** web发布模式 */
  WEB = "web",
}

export interface Options {
  /** 发布模式 */
  mode: PublishModeEnum;
  /**
   * 发布类型
   */
  type?: PublishVersionTypeEnum;
  /** (发布成功后)是否推送至远程仓库 */
  push: boolean;
}
