import { GitRefLogTypeEnum } from "./log-resolve";

/** git合并分支信息 */
export interface GitMergeBranchInfo {
  /** 合并的源分支 */
  fromBranch: string;
  /** 合并到该分支 */
  toBranch?: string;
}

/** 解析合并信息-通过提交信息 */
export const resolveMergeInfoByCommitMsg = (
  commitMsg = "",
): GitMergeBranchInfo | undefined => {
  const mergeReg1 =
    /\s*Merge\s+branch\s+['|"](.+)['|"]\s+into\s+['|"](.+)['|"]\s*/i;
  const match1 = commitMsg.match(mergeReg1);
  if (match1) {
    const [, fromBranch, toBranch] = match1;
    return {
      fromBranch,
      toBranch,
    };
  }
  const mergeReg2 =
    /\s*Merge\s+branch\s+['|"](.+)['|"]\s+of\s+.+\s+into\s+['|"](.+)['|"]\s*/i;
  const match2 = commitMsg.match(mergeReg2);
  if (match2) {
    const [, fromBranch, toBranch] = match2;
    return {
      fromBranch,
      toBranch,
    };
  }

  const mergeReg3 = /\s*Merge\s+branch\s+['|"](.+)['|"](\s+of)?\s*/i;
  const match3 = commitMsg.match(mergeReg3);
  if (match3) {
    const [, fromBranch] = match3;
    return {
      fromBranch,
    };
  }
};

/** 从reflog type解析合并信息 */
export const resolveMergeInfoByRefType = (
  type: string,
): GitMergeBranchInfo | undefined => {
  if (type.startsWith(GitRefLogTypeEnum.MERGE)) {
    const fromBranch = type.replace(GitRefLogTypeEnum.MERGE, "").trim();
    return {
      fromBranch,
    };
  }
};

/** 从reflog action解析合并信息 */
export const resolveMergeInfoByGitReflogAction = ():
  | GitMergeBranchInfo
  | undefined => {
  const gitReflogAction = process.env.GIT_REFLOG_ACTION || "";
  if (!gitReflogAction) {
    return;
  }
  const mergeReg1 = /merge\s+([^\s]+)\s*/i;
  const match1 = gitReflogAction.match(mergeReg1);
  if (match1) {
    const [, fromBranch] = match1;
    return {
      fromBranch,
    };
  }

  const mergeReg2 = /pull\s+([^\s]+)\s+([^\s]+)/;
  const match2 = gitReflogAction.match(mergeReg2);
  if (match2) {
    const [, , fromBranch] = match2;
    return {
      fromBranch,
    };
  }
};
