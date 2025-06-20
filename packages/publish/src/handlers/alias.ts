import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import type { AliasOptions, ConfigInfo } from "@/types";
import { PublishModeEnum, SubcommandEnum } from "@/types";
import {
  getConfigFileCommonOptions,
  readConfigFile,
} from "@done-coding/cli-utils";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";

/** 获取别名发布选项 */
export const getAliasOptions = () =>
  getConfigFileCommonOptions({
    configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  });

/** 别名发布命令处理器 */
export const aliasHandler = async (argv: CliHandlerArgv<AliasOptions>) => {
  const configInfo = await readConfigFile<ConfigInfo>(argv, () => {
    return {};
  });

  const aliasInfoList = configInfo[PublishModeEnum.NPM]?.aliasInfo || [];
  console.log(aliasInfoList);
};

export const aliasCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.ALIAS,
  describe: "别名发布",
  options: getAliasOptions(),
  handler: aliasHandler as SubCliInfo["handler"],
};
