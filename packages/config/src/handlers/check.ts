import {
  ConfigModuleEnum,
  SubcommandEnum,
  type CheckConfigOptions,
  type ConfigConfig,
  type TypeConfigInfo,
} from "@/types";
import {
  ALLOW_MODULE_LIST,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
  getConfig,
  getConfigInfo,
} from "@/utils";
import type { SubCliInfo } from "@done-coding/cli-utils";
import { getConfigFileCommonOptions, log } from "@done-coding/cli-utils";
import type { ArgumentsCamelCase } from "yargs";
import type yargs from "yargs";

export const getOptions = (): {
  [key: string]: yargs.Options;
} => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
    moduleList: {
      type: "array",
      alias: "m",
      description: "需要检测的工程化配置模块",
      choices: ALLOW_MODULE_LIST,
      default: ALLOW_MODULE_LIST.filter(
        (item) => item !== ConfigModuleEnum.MERGELINT,
      ),
    },
  };
};

export const handler = async (
  argv: ArgumentsCamelCase<CheckConfigOptions>,
): Promise<{
  config: ConfigConfig;
  info: TypeConfigInfo;
}> => {
  const config = await getConfig(argv);
  const info = getConfigInfo({ config, rootDir: argv.rootDir });
  log.success(`检测到工程化配置信息: 
${JSON.stringify(info, null, 2)}`);
  return {
    config,
    info,
  };
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.CHECK,
  describe: "检测工程化配置",
  options: getOptions(),
  handler: handler as unknown as SubCliInfo["handler"],
};
