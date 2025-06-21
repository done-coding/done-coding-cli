import { execSync } from "node:child_process";
import {
  resolveMergeInfoByCommitMsg,
  resolveMergeInfoByRefType,
  type GitMergeBranchInfo,
} from "./merge-resolve";
import { resolveCheckoutInfoByRefInfo } from "./checkout-resolve";
import { log } from "@/log";

/** git checkout信息 */
export interface GitCheckoutInfo {
  fromBranch: string;
  toBranch: string;
}

/** git日志通用信息 */
export interface GitLogCommonInfo {
  hash: string;
  /** 提交信息 */
  message: string;
  /** 合并信息 */
  mergeInfo?: GitMergeBranchInfo;
}

export interface GitLogItemInfo extends GitLogCommonInfo {
  /** 作者 */
  author: string;
  /** 作者邮箱 */
  authorEmail: string;
  /** 创作日期 */
  createDate: string;
  /** 提交者 */
  committer: string;
  /** 提交者邮箱 */
  committerEmail: string;
  /** 提交时间 */
  commitTime: string;
}

/** 提交日志信息 */
export interface GitReflogItemInfoRaw
  extends Omit<GitLogCommonInfo, "message"> {
  hash: string;
  /** 完整信息 */
  fullMessage: string;
  /** 提交者 */
  committer: string;
  /** 提交者邮箱 */
  committerEmail: string;
  /** 提交时间 */
  commitTime: string;
}

/** reflog类型 */
export enum GitRefLogTypeEnum {
  /** checkout */
  CHECKOUT = "checkout",
  /** merge $branch */
  MERGE = "merge",
  /** 提交 */
  COMMIT = "commit",
  /** 合并提交 */
  COMMIT_MERGE = "commit (merge)",
  /** pull $origin $branch */
  PULL = "pull",
  /** reset */
  RESET = "reset",
  /** rebase (start) */
  REBASE_START = "rebase (start)",
  /** rebase (finish) */
  REBASE_FINISH = "rebase (finish)",
  /** rebase (abort) */
  REBASE_ABORT = "rebase (abort)",
  /** rebase (continue) */
  REBASE_CONTINUE = "rebase (continue)",
}

/**  rebase的阶段 */
export type GitRefLogRebaseStage =
  | GitRefLogTypeEnum.REBASE_START
  | GitRefLogTypeEnum.REBASE_FINISH
  | GitRefLogTypeEnum.REBASE_ABORT
  | GitRefLogTypeEnum.REBASE_CONTINUE;

export interface GitRebaseInfo {
  /** rebase的阶段 */
  stage?: GitRefLogRebaseStage;
  /** 变基的原始分支 */
  originBranch: string;
  /** 变基的目标分支 */
  targetBranch: string;
}

/** reflog信息 */
export interface GitReflogItemInfo
  extends Omit<GitReflogItemInfoRaw, "fullMessage">,
    Pick<GitLogCommonInfo, "message"> {
  type: GitRefLogTypeEnum;
}

const REPLACE_MARK = "__GIT_REPLACE_MARK__";

const gitJSON = {
  stringify(obj: object) {
    return JSON.stringify(obj).replace(/"/g, REPLACE_MARK);
  },
  parse(str: string) {
    return JSON.parse(str.replace(new RegExp(REPLACE_MARK, "g"), '"'));
  },
};

/** 获取当前分支最近提交列表 */
export const getCurrentBranchLastCommitList = ({
  count = 100,
}: {
  count?: number;
  /** 某个hash之后的提交 */
  afterHash?: string;
} = {}) => {
  if (count <= 0) {
    return [];
  }
  const logInfoTemplate: GitLogItemInfo = {
    hash: "%H",
    /** 提交信息 */
    message: "%s",
    /** 作者 */
    author: "%an",
    /** 作者邮箱 */
    authorEmail: "%ae",
    /** 创作日期 */
    createDate: "%ai",
    /** 提交者 */
    committer: "%cn",
    /** 提交者邮箱 */
    committerEmail: "%ce",
    /** 提交日期 */
    commitTime: "%ci",
  };

  const bufferRes = execSync(
    `git --no-pager log --oneline -n ${count} --pretty=format:"${gitJSON.stringify(
      logInfoTemplate,
    )}"`,
  );

  const strRes = bufferRes.toString();

  const list: GitLogItemInfo[] = strRes.split("\n").map((item) => {
    const obj = gitJSON.parse(item) as GitLogItemInfo;
    return {
      ...obj,
      mergeInfo: resolveMergeInfoByCommitMsg(obj.message),
    };
  });

  return list;
};

/** 获取最后的reflog */
export const getLastReflogList = ({
  count = 100,
  filterItem = () => true,
}: {
  count?: number;
  /** 某个hash之后的提交 */
  afterHash?: string;
  /** 过滤函数 */
  filterItem?: (item: GitReflogItemInfoRaw) => boolean;
} = {}): GitReflogItemInfo[] => {
  if (count <= 0) {
    return [];
  }
  const refLogInfoTemplate: GitReflogItemInfoRaw = {
    hash: "%H",
    fullMessage: "%gs",
    committer: "%cn",
    committerEmail: "%ce",
    commitTime: "%ci",
  };

  const bufferRes = execSync(
    `git --no-pager reflog -n ${count} --pretty=format:"${gitJSON.stringify(
      refLogInfoTemplate,
    )}"`,
  );

  const strRes = bufferRes.toString();

  const listRaw: GitReflogItemInfoRaw[] = strRes
    .split("\n")
    .map((item) => gitJSON.parse(item))
    .filter(filterItem);

  const list = listRaw.map((item) => {
    const { fullMessage, ...rest } = item;
    const splitMark = ":";
    const [typeRaw] = fullMessage.split(splitMark, 1);
    const messageRaw = fullMessage.slice(`${typeRaw}${splitMark}`.length);

    const type = typeRaw.trim() as GitRefLogTypeEnum;
    const message = messageRaw.trim();
    let mergeInfo: GitMergeBranchInfo | undefined;
    let checkoutInfo: GitCheckoutInfo | undefined;
    let rebaseInfo: GitRebaseInfo | undefined;
    if (type.startsWith(GitRefLogTypeEnum.CHECKOUT)) {
      checkoutInfo = resolveCheckoutInfoByRefInfo(message);
    } else if (type.startsWith(GitRefLogTypeEnum.MERGE)) {
      mergeInfo = resolveMergeInfoByRefType(type);
    } else if (type.startsWith(GitRefLogTypeEnum.COMMIT_MERGE)) {
      const res = resolveMergeInfoByCommitMsg(message);
      if (!res) {
        log.warn(
          `${item.hash} 是合并提交 但是未从提交信息(${message})中检测到合并分支信息，推测手动更改了提交内容`,
        );
      }
      mergeInfo = res;
    }
    return {
      ...rest,
      type,
      message,
      mergeInfo,
      checkoutInfo,
      rebaseInfo,
    };
  });

  return list;
};
