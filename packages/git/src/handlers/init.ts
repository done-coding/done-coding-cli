import type { ArgumentsCamelCase, SubCliInfo } from "@done-coding/cli-utils";
import { InitTypeEnum, SubcommandEnum, type InitOptions } from "@/types";
import {
  addHuskyHooks,
  execSyncWithLogDispatch,
  getConfigFileCommonOptions,
  initHandlerCommon,
  log,
  xPrompts,
} from "@done-coding/cli-utils";
import type { SupportCheckReverseMergeHooksNameType } from "@/utils";
import {
  getGitUsernameForm,
  getPlatformForm,
  gitAccessTokenForm,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  setGitConfigInfo,
  SUPPORT_CHECK_REVERSE_MERGE_HOOKS_NAME,
} from "@/utils";
import configDefault from "@/config";

/** 获取初始化选项 */
export const getOptions = () => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
    type: {
      alias: "t",
      describe: "初始化类型",
      choices: [InitTypeEnum.DEFAULT, InitTypeEnum.CLONE_CONFIG],
      default: InitTypeEnum.DEFAULT,
    },
  };
};

const addScript = (commandPrefix: string) => {
  execSyncWithLogDispatch(
    `npm pkg set scripts.postprepare="${commandPrefix} init"`,
  );
};

export const handler = async (
  argv: ArgumentsCamelCase<InitOptions> & {
    /** 是否是子命令 */
    isSubCommand?: boolean;
  },
) => {
  const { type } = argv;
  switch (type) {
    case InitTypeEnum.DEFAULT: {
      const { rootDir, isSubCommand, _ } = argv;

      const commandPrefix = `${argv.$0}${isSubCommand ? ` ${_[0]}` : ""}`;

      await addHuskyHooks<SupportCheckReverseMergeHooksNameType>({
        hookNames:
          SUPPORT_CHECK_REVERSE_MERGE_HOOKS_NAME as unknown as SupportCheckReverseMergeHooksNameType[],
        rootDir,
        getCode: (name) => `npx ${commandPrefix} hooks ${name} "$@"`,
      });

      await addScript(commandPrefix);

      return initHandlerCommon(configDefault, argv, {
        onFileGenerated: (path) => {
          log.info(`文件生成成功: ${path}`);
        },
      });
    }
    case InitTypeEnum.CLONE_CONFIG: {
      const { rootDir } = argv;
      const { platform } = await xPrompts(getPlatformForm());
      const { username } = await xPrompts(getGitUsernameForm());
      const { accessToken } = await xPrompts(gitAccessTokenForm);

      return setGitConfigInfo({
        rootDir,
        platform,
        username,
        accessToken,
      });
    }
    default: {
      throw new Error(`未知的初始化类型: ${type}`);
    }
  }
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INIT,
  describe: "初始化配置文件",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
