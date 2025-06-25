import type { SubCliInfo } from "@done-coding/cli-utils";
import {
  readConfigFile,
  getConfigFileCommonOptions,
  type CliHandlerArgv,
  type CliInfo,
  log,
} from "@done-coding/cli-utils";
import {
  GenerateModeEnum,
  SubcommandEnum,
  type ExtractConfig,
  type GenerateOptions,
} from "@/types";
import {
  contentResolve,
  keyConfigResolve,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
} from "@/utils";
import { batchCompileHandler } from "@done-coding/cli-template";
import configDefault from "@/config";

/** 获取生成命令选项 */
export const getOptions = (): CliInfo["options"] => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
    mode: {
      type: "string",
      alias: "m",
      choices: Object.values(GenerateModeEnum),
      default: GenerateModeEnum.RESULT,
      describe: "生成模式",
    },
  };
};

/** 将提取的信息生成文件 */
export const generateFile = async ({
  rootDir = process.cwd(),
  config,
}: {
  rootDir?: string;
  config: ExtractConfig;
}) => {
  const { extractInput, extractOutput } = config;

  const extraEnvData = Object.entries(extractInput).reduce(
    (outerAcc, [input, inputConfig]) => {
      const content = contentResolve({
        rootDir,
        input,
      });

      return Object.entries(inputConfig).reduce(
        (innerAcc, [targetKey, keyConfig]) => {
          const value = keyConfigResolve({
            content,
            targetKey,
            keyConfig,
          });

          // 不用 lodash 的 set 方法，直接赋值, 支持存在 ${a.b.c}
          innerAcc[targetKey] = value;
          return innerAcc;
        },
        outerAcc,
      );
    },
    {} as unknown as Record<string, any>,
  );

  await batchCompileHandler(
    {
      rootDir,
      extraEnvData,
    },
    extractOutput,
  );
};

/** 提取文件命令处理器 */
export const handler = async (argv: CliHandlerArgv<GenerateOptions>) => {
  const config = await readConfigFile<ExtractConfig>(argv, () => {
    log.info(`配置文件为空，使用默认配置`);
    return configDefault;
  });
  if (!config) {
    log.error(`配置文件为空`);
    return process.exit(1);
  }

  const { rootDir } = argv;

  await generateFile({ rootDir, config });
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.GENERATE,
  describe: "生成文件",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
