import { ReadConfigFileOptions } from "@done-coding/cli-utils";
import { SubcommandEnum } from "./subcommand";

/** 检测类型 */
export enum CheckTypeEnum {
  /** 反向提交 */
  REVERSE_MERGE = "reverseMerge",
}

/** 检测反向方式枚举 */
export enum CheckReverseMergeWayEnum {
  /** GIT_REFLOG_ACTION */
  REFLOG_ACTION = "reflog-action",
  /** 提交信息 */
  COMMIT_MSG = "commit-msg",
  /** 提交记录 */
  COMMIT_RECORD = "commit-record",
  /** 变基线 */
  PRE_REBASE = "pre-rebase",
}

/** 检测反向 */
export type CheckOptions = ReadConfigFileOptions & {
  type: CheckTypeEnum;
  args: string[];
};

/**
 * 禁止合并某个分支的检测选项
 */
export interface GitConfigCheckReverseMergeBranchConfig {
  /** 包括变基操作 */
  includeRebase: boolean;
  /** 某个hash之后的提交 */
  afterHash?: string;
  /** 最多(检查日志数量) */
  logCount: number;
}

/** 螃蟹git配置 */
export interface GitConfig {
  [SubcommandEnum.CHECK]: {
    [CheckTypeEnum.REVERSE_MERGE]: Record<
      string,
      GitConfigCheckReverseMergeBranchConfig
    >;
  };
}
