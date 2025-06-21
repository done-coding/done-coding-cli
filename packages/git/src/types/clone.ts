/** Git 平台枚举 */
export enum GitPlatformEnum {
  /** GitHub */
  GITHUB = "github",
  /** Gitee */
  GITEE = "gitee",
}

/** git参数信息 */
export interface GitParamsInfo {
  /** 平台 */
  platform: GitPlatformEnum;
  /** 用户名 */
  username: string;
  /** 项目名称 */
  projectName?: string;
}

/** 可控选项 */
export type CloneOptions = GitParamsInfo;

/** Git 配置信息 */
export interface GitConfigInfo {
  /** token */
  accessToken: string;
}
