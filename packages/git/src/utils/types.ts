/** 子命令枚举 */
export enum SubcommandEnum {
  /** 克隆 */
  CLONE = "clone",
}

/** Git 平台枚举 */
export enum GitPlatformEnum {
  /** GitHub */
  GITHUB = "github",
  /** Gitee */
  GITEE = "gitee",
}

export interface Options {
  /** 平台 */
  platform: GitPlatformEnum;
  /** 用户名 */
  username: string;
}
