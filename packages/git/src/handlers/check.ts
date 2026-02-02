import type { CheckOptions, GitConfig } from "@/types";
import {
  CheckReverseMergeWayEnum,
  CheckTypeEnum,
  SubcommandEnum,
} from "@/types";
import {
  checkIsReverseMerge,
  getCheckReverseMergeConfigMap,
  getCheckReverseMergeMaxIndexMap,
  getCheckReverseMergeMaxLogCount,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
} from "@/utils";
import type {
  ArgumentsCamelCase,
  GitRebaseInfo,
  GitReflogItemInfo,
  SubCliInfo,
  SupportGetCommitByHookName,
  YargsOptions,
} from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  readConfigFile,
  resolveMergeInfoByGitReflogAction,
  checkCurrentIsRebasing,
  resolveMergeInfoByCommitMsg,
  outputConsole,
  getCurrentBranchName,
  getCommitByHookName,
  getLastReflogList,
  getCurrentBranchLastCommitList,
} from "@done-coding/cli-utils";
import type { PositionalOptions } from "yargs";

export const getOptions = (): Record<string, YargsOptions> =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

export const getPositionals = (): Record<string, PositionalOptions> => {
  return {
    type: {
      describe: "检测类型",
      type: "string",
      choices: [CheckTypeEnum.REVERSE_MERGE],
    },
  };
};

/** 检测反向合并-通过git reflog action */
export const checkReverseMergeByReflogAction = ({
  config,
  currentBranch,
}: {
  config: GitConfig;
  currentBranch?: string;
}) => {
  const mergeInfo = resolveMergeInfoByGitReflogAction();
  if (!mergeInfo) {
    return;
  }

  const configMap = getCheckReverseMergeConfigMap(config);

  const isReverseMerge = checkIsReverseMerge({
    mergeInfo,
    configMap,
    currentBranch,
  });

  const { fromBranch } = mergeInfo!;

  /** 有反向合并 */
  if (isReverseMerge) {
    const errorMsg = `发现当前执行 git ${process.env.GIT_REFLOG_ACTION}
意欲反向合并${fromBranch} 
拦截 !!!

--------- 建议 ---------
可以通过
1.查看当前已提交记录的最新版本号  
  git log  
2. 回退到当前已提交记录的最新版本
  git reset --hard <当前已提交记录的最新版本号> 
    `;
    outputConsole.error(errorMsg);
    return process.exit(1);
  }
};

/** 检测反向合并-通过提交信息 */
export const checkReverseMergeByCommitMsg = ({
  config,
  currentBranch,
  commitMsg,
  rootDir,
}: {
  config: GitConfig;
  currentBranch?: string;
  commitMsg?: string;
  rootDir: string;
}) => {
  if (checkCurrentIsRebasing(rootDir)) {
    return outputConsole.skip(`当前在变基中, 不通过提交信息检测合并`);
  }

  const mergeInfo = resolveMergeInfoByCommitMsg(commitMsg);

  const configMap = getCheckReverseMergeConfigMap(config);

  const isReverseMerge = checkIsReverseMerge({
    mergeInfo,
    configMap,
    currentBranch,
  });

  /** 有反向合并 */
  if (isReverseMerge) {
    const { fromBranch, toBranch = currentBranch } = mergeInfo!;
    const errorMsg = `禁止${fromBranch}被合并: ${fromBranch} => ${toBranch}

--------- 建议 ---------
可以通过
1.查看当前已提交记录的最新版本号  
  git log  
2. 回退到当前已提交记录的最新版本
  git reset --hard <当前已提交记录的最新版本号> 
        `;
    outputConsole.error(errorMsg);
    return process.exit(1);
  }
};

/** 检测反向合并-通过提交记录 */
export const checkReverseMergeByCommitRecord = ({
  config,
  currentBranch,
}: {
  config: GitConfig;
  currentBranch?: string;
}) => {
  const configMap = getCheckReverseMergeConfigMap(config);

  const maxLogCount = getCheckReverseMergeMaxLogCount(configMap);
  if (!maxLogCount) {
    return;
  }

  const logList = getCurrentBranchLastCommitList({ count: maxLogCount });

  const maxIndexMap = getCheckReverseMergeMaxIndexMap(configMap, logList);

  const logHashList = logList.map((item) => item.hash);

  const reflogList = getLastReflogList({
    /** 考虑reflog存在往复切换  */
    count: maxLogCount + 30,
    filterItem: (item) => {
      return logHashList.includes(item.hash);
    },
  });

  const reflogHashMap = reflogList.reduce(
    (acc, item) => {
      if (item.mergeInfo) {
        acc[item.hash] = item;
      }
      return acc;
    },
    {} as unknown as Record<string, GitReflogItemInfo>,
  );

  logList.forEach((item, index) => {
    const mergeInfo = item.mergeInfo || reflogHashMap[item.hash]?.mergeInfo;

    if (!mergeInfo) {
      return;
    }

    Object.entries(configMap).forEach(([branchReg]) => {
      const maxIndex = maxIndexMap[branchReg];
      if (index > maxIndex) {
        outputConsole.skip(
          `${branchReg} 只检测${maxIndex + 1}条， 超出不再检测`,
        );
        return;
      }

      const isReverseMerge = checkIsReverseMerge({
        mergeInfo,
        configMap,
        currentBranch,
      });

      const { fromBranch } = mergeInfo!;

      /** 有反向合并 */
      if (isReverseMerge) {
        const errorMsg = `发现${fromBranch}被合并
  本次提交版本 ${item.hash}
  提交注释 ${item.message}
  提交人: ${item.committer}
  提交时间: ${item.commitTime}

--------- 建议 ---------
可以通过
1.查看操作日志版本号为${item.hash}的前一次操作的版本号 
  git reflog
3. 回退到前一次操作的版本号 
  git reset --hard <当前已提交记录的最新版本号> 
`;
        outputConsole.error(errorMsg);
        return process.exit(1);
      }
    });
  });
};

/** 检测反向变基 */
export const checkReverseRebase = ({
  config,
  rebaseInfo,
}: {
  config: GitConfig;
  rebaseInfo: GitRebaseInfo;
}) => {
  const configMap = getCheckReverseMergeConfigMap(config);

  const configList = Object.entries(configMap);

  const { targetBranch, originBranch } = rebaseInfo;

  for (let [regStr, checkReverseMergeConfig] of configList) {
    if (checkReverseMergeConfig.includeRebase) {
      const reg = new RegExp(regStr);
      if (reg.test(targetBranch)) {
        const errorMsg = `禁止变基到${targetBranch}的基线
    即 禁止${originBranch}分子包含${targetBranch}分支(可能)存在的其他需求的代码`;
        outputConsole.error(errorMsg);
        return process.exit(1);
      }
    } else {
      outputConsole.skip(`不检测是否变基到${targetBranch}的基线`);
    }
  }

  outputConsole.success(`允许变基到${targetBranch}`);
};

export type CheckReverseMergeHandlerParams =
  | {
      config: GitConfig;
      rootDir: string;
      way: CheckReverseMergeWayEnum.COMMIT_MSG;
      hookName: SupportGetCommitByHookName;
    }
  | {
      config: GitConfig;
      rootDir: string;
      way: CheckReverseMergeWayEnum.REFLOG_ACTION;
    }
  | {
      config: GitConfig;
      rootDir: string;
      way: CheckReverseMergeWayEnum.COMMIT_RECORD;
    }
  | {
      config: GitConfig;
      way: CheckReverseMergeWayEnum.PRE_REBASE;
      args: string[];
    };

/** 检测反向合并 */
export const checkReverseMergeHandler = async (
  params: CheckReverseMergeHandlerParams,
) => {
  const { config, way } = params;

  const currentBranch = getCurrentBranchName();

  switch (way) {
    case CheckReverseMergeWayEnum.REFLOG_ACTION: {
      checkReverseMergeByReflogAction({ config, currentBranch });
      break;
    }
    case CheckReverseMergeWayEnum.COMMIT_MSG: {
      const { hookName, rootDir } = params;
      const commitMsg = getCommitByHookName({
        hookName,
        rootDir,
      });
      checkReverseMergeByCommitMsg({
        config,
        currentBranch,
        commitMsg,
        rootDir,
      });
      break;
    }
    case CheckReverseMergeWayEnum.COMMIT_RECORD: {
      checkReverseMergeByCommitRecord({ config, currentBranch });
      break;
    }
    case CheckReverseMergeWayEnum.PRE_REBASE: {
      const { args } = params;
      const [
        targetBranch,
        /** 能进入 rebase 说明originBranch有值 或者 当前在某个分支上 */
        originBranch = currentBranch!,
      ] = args;
      checkReverseRebase({
        config,
        rebaseInfo: {
          targetBranch,
          originBranch,
        },
      });
      break;
    }
    default: {
      throw new Error(`不支持的检测方式${way}`);
    }
  }
};

/** 检测 */
export const handler = async (argv: ArgumentsCamelCase<CheckOptions>) => {
  const config = await readConfigFile<GitConfig>(argv);

  const { type } = argv;
  switch (type) {
    case CheckTypeEnum.REVERSE_MERGE: {
      await checkReverseMergeHandler({
        rootDir: argv.rootDir,
        config,
        way: CheckReverseMergeWayEnum.COMMIT_RECORD,
      });
      break;
    }
    default: {
      throw new Error(`不支持的检测类型${type}`);
    }
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.CHECK} <type>`,
  describe: "检查git操作",
  options: getOptions(),
  positionals: getPositionals(),
  handler: handler as SubCliInfo["handler"],
};
