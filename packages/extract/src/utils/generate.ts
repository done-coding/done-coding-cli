import {
  readConfigFile,
  getConfigFileCommonOptions,
  type CliHandlerArgv,
  type CliInfo,
  log,
} from "@done-coding/cli-utils";
import type { ExtractConfig, GenerateOptions } from "./types";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "./path";
import { batchCompileHandler } from "@done-coding/cli-template";
import { keyConfigResolve, contentResolve } from "./resolve";

/** 获取生成命令选项 */
export const getGenerateOptions = (): CliInfo["options"] => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
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
export const generateHandler = async (
  argv: CliHandlerArgv<GenerateOptions>,
) => {
  const config = await readConfigFile<ExtractConfig>(argv);
  if (!config) {
    log.error(`配置文件为空`);
    return process.exit(1);
  }

  const { rootDir } = argv;

  await generateFile({ rootDir, config });
};
