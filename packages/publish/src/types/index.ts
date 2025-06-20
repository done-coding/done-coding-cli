import type {
  GetGitLastCommitParams,
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 初始化发布配置文件 */
  INIT = "init",
  /** 发布执行 */
  EXEC = "exec",
  /** 发布别名 */
  ALIAS = "alias",
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

/** 发布模式 */
export enum PublishModeEnum {
  /** npm发布模式 */
  NPM = "npm",
  /** web发布模式 */
  WEB = "web",
}

/** 发布配置- web模式 */
export interface ConfigInfoWeb extends GetGitLastCommitParams {
  /**
   * web构建命令
   */
  build?: string;
}

/** 发布配置- npm模式-别名信息 */
export interface ConfigInfoNpmAliasInfo {}

/** 发布配置- npm模式 */
export interface ConfigInfoNpm extends GetGitLastCommitParams {
  /** 别名信息 */
  aliasInfo?: ConfigInfoNpmAliasInfo[];
}

/**
 * 配置信息
 */
export interface ConfigInfo {
  /** web发布配置 */
  [PublishModeEnum.WEB]?: ConfigInfoWeb;
  /** NPM发布配置 */
  [PublishModeEnum.NPM]?: ConfigInfoNpm;
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

export interface AliasOptions extends ReadConfigFileOptions {}
