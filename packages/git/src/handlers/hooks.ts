import type { ArgumentsCamelCase, PositionalOptions } from "yargs";
import type { GitConfig, HooksOptions } from "@/types";
import { CheckReverseMergeWayEnum, SubcommandEnum } from "@/types";
import type { SubCliInfo, YargsOptions } from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  HooksNameEnum,
  outputConsole,
  readConfigFile,
} from "@done-coding/cli-utils";
import { checkReverseMergeHandler } from "./check";
import {
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  SUPPORT_HOOKS_NAME,
} from "@/utils";

export const getOptions = (): Record<string, YargsOptions> =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

export const getPositionals = (): Record<string, PositionalOptions> => {
  return {
    name: {
      describe: "钩子名称",
      type: "string",
      choices: SUPPORT_HOOKS_NAME,
    },
  };
};

export const handler = async (argv: ArgumentsCamelCase<HooksOptions>) => {
  const { name: hookName, rootDir, args } = argv;
  switch (hookName) {
    case HooksNameEnum.PRE_MERGE_COMMIT: {
      const config = await readConfigFile<GitConfig>(argv);
      checkReverseMergeHandler({
        config,
        way: CheckReverseMergeWayEnum.REFLOG_ACTION,
        rootDir,
      });
      break;
    }
    case HooksNameEnum.PREPARE_COMMIT_MSG: {
      const config = await readConfigFile<GitConfig>(argv);

      checkReverseMergeHandler({
        config,
        way: CheckReverseMergeWayEnum.COMMIT_MSG,
        hookName,
        rootDir,
      });
      break;
    }
    case HooksNameEnum.POST_MERGE:
    case HooksNameEnum.PRE_PUSH: {
      const config = await readConfigFile<GitConfig>(argv);
      checkReverseMergeHandler({
        config,
        way: CheckReverseMergeWayEnum.COMMIT_RECORD,
        rootDir,
      });
      break;
    }
    case HooksNameEnum.PRE_REBASE: {
      const config = await readConfigFile<GitConfig>(argv);
      checkReverseMergeHandler({
        config,
        way: CheckReverseMergeWayEnum.PRE_REBASE,
        args: args as string[],
      });
      break;
    }
    default: {
      outputConsole.error(`${hookName} 当前未支持处理`);
    }
  }
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.HOOKS} <name> [args...]`,
  describe: "git钩子回调",
  options: getOptions(),
  positionals: getPositionals(),
  handler: handler as SubCliInfo["handler"],
};
