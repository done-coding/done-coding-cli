import type {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 初始化发布配置文件 */
  INIT = "init",
  /** 发布执行 */
  EXEC = "exec",
}

export type InitOptions = InitConfigFileOptions;

/**
 * 发布版本类型
 */
export enum PublishVersionTypeEnum {
  /**
   * 主版本号
   */
  MAJOR = "major",
  /**
   * 次版本号
   */
  MINOR = "minor",
  /**
   * 修订版本号
   */
  PATCH = "patch",
  /**
   * 预发布版本号
   */
  PREMAJOR = "premajor",
  /**
   * 预发布次版本号
   */
  PREMINOR = "preminor",
  /**
   * 预发布修订版本号
   */
  PREPATCH = "prepatch",
  /**
   * 预发布版本号
   */
  PRERELEASE = "prerelease",
}

/**
 * 发布标签类型
 */
export enum PublishTagEnum {
  /**
   * 最新版本
   */
  LATEST = "latest",
  /**
   * next版本
   */
  NEXT = "next",
  /**
   * alpha版本
   */
  ALPHA = "alpha",
}

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
  webBuild?: string;
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

export interface ExecOptions extends ReadConfigFileOptions {
  /** 发布模式 */
  mode: PublishModeEnum;
  /**
   * 发布类型
   */
  type?: PublishVersionTypeEnum;
  /** (发布成功后)是否推送至远程仓库 */
  push: boolean;
}
