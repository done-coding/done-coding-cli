import type { GitConfig } from "@/types";
import { CheckTypeEnum, SubcommandEnum } from "@/types";
import type {
  GitLogItemInfo,
  GitReflogItemInfo,
  GitMergeBranchInfo,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";

/** 获取检测反向合并配置map */
export const getCheckReverseMergeConfigMap = (config: GitConfig) => {
  const {
    [SubcommandEnum.CHECK]: { [CheckTypeEnum.REVERSE_MERGE]: map },
  } = config;

  return map;
};

/** 获取检测反向合并配置map类型 */
export type CheckReverseMergeConfigMap = ReturnType<
  typeof getCheckReverseMergeConfigMap
>;

/** 获取检测反向合并配置的最大日志数量 */
export const getCheckReverseMergeMaxLogCount = (
  configMap: CheckReverseMergeConfigMap,
) => {
  return Math.max(
    0,
    ...Object.values(configMap).map(({ logCount }) => logCount),
  );
};

/** 获取检测反向合并配置的最大索引map */
export const getCheckReverseMergeMaxIndexMap = (
  configMap: CheckReverseMergeConfigMap,
  logList: (GitLogItemInfo | GitReflogItemInfo)[],
) => {
  return Object.entries(configMap).reduce(
    (acc, [branchReg, { afterHash, logCount }]) => {
      let maxIndex = logCount - 1;
      if (afterHash) {
        const index = logList.findIndex((item) => item.hash === afterHash);
        if (index !== -1) {
          // (afterHash:${index + 1}, logCount:${logCount})
          outputConsole.info(
            `${branchReg} 设置 只检测 ${afterHash} 之后的日志 即 下标 [0 - ${index})`,
          );
          maxIndex = Math.min(maxIndex, index - 1);
        }
      }

      outputConsole.info(`${branchReg} 最多检查${maxIndex + 1}条`);

      acc[branchReg] = maxIndex;

      return acc;
    },
    {} as unknown as Record<string, number>,
  );
};

/**
 * 检测是否是反向合并
 *
 */
export const checkIsReverseMerge = ({
  mergeInfo,
  configMap,
  currentBranch,
}: {
  mergeInfo?: GitMergeBranchInfo;
  configMap: CheckReverseMergeConfigMap;
  currentBranch?: string;
}) => {
  if (!mergeInfo) {
    return;
  }

  const { fromBranch, toBranch = currentBranch } = mergeInfo;

  if (fromBranch === currentBranch) {
    outputConsole.skip(`跳过: 允许远程${fromBranch} => 本地${toBranch}`);
    return;
  }

  const mustNotBeMergeBranchRegList = Object.keys(configMap).map(
    (item) => new RegExp(item),
  );

  const res = !!mustNotBeMergeBranchRegList.find((item) =>
    item.test(fromBranch),
  );

  if (!res) {
    outputConsole.skip(`跳过: 允许${fromBranch} => ${toBranch}`);
  }

  return res;
};
