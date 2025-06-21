import { HooksNameEnum } from "@done-coding/cli-utils";

/** 支持的git hooks名称 */
export const SUPPORT_HOOKS_NAME = [
  HooksNameEnum.PRE_COMMIT,
  HooksNameEnum.PRE_MERGE_COMMIT,
  HooksNameEnum.PREPARE_COMMIT_MSG,
  HooksNameEnum.COMMIT_MSG,
  HooksNameEnum.PRE_REBASE,
  HooksNameEnum.POST_COMMIT,
  HooksNameEnum.POST_MERGE,
  HooksNameEnum.PRE_PUSH,
];

/** 支持的检查反向合并的git hooks名称 */
export const SUPPORT_CHECK_REVERSE_MERGE_HOOKS_NAME = [
  HooksNameEnum.PRE_MERGE_COMMIT,
  HooksNameEnum.PREPARE_COMMIT_MSG,
  HooksNameEnum.POST_MERGE,
  HooksNameEnum.PRE_PUSH,
  HooksNameEnum.PRE_REBASE,
] as const;

/** 支持的检查反向合并的git hooks名称类型 */
export type SupportCheckReverseMergeHooksNameType =
  (typeof SUPPORT_CHECK_REVERSE_MERGE_HOOKS_NAME)[number];
