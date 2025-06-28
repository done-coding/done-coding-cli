import {
  getConfigFileCommonOptions,
  type CliInfo,
} from "@done-coding/cli-utils";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "./path";
import { OutputModeEnum, type CompileOptions } from "@/types";

/** 编译默认选项 */
export const defaultCompileOptions: Pick<
  CompileOptions,
  "rollback" | "dealMarkdown" | "mode" | "batch" | "rollbackDelNullFile"
> = {
  rollback: false,
  dealMarkdown: false,
  mode: OutputModeEnum.OVERWRITE,
  batch: false,
  rollbackDelNullFile: false,
};

/** 设置编译默认选项 */
export const completeDefaultCompileOptions = <
  T extends typeof defaultCompileOptions,
>(
  options: T,
) => {
  const {
    rollback,
    dealMarkdown,
    mode,
    batch,
    rootDir,
    configPath,
    rollbackDelNullFile,
    ...rest
  } = options as unknown as CompileOptions;
  const { rootDir: rootDirConfig, configPath: configPathConfig } =
    getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    });
  return {
    rollback: rollback ?? defaultCompileOptions.rollback,
    rollbackDelNullFile:
      rollbackDelNullFile ?? defaultCompileOptions.rollbackDelNullFile,
    dealMarkdown: dealMarkdown ?? defaultCompileOptions.dealMarkdown,
    mode: mode ?? defaultCompileOptions.mode,
    batch: batch ?? defaultCompileOptions.batch,
    rootDir: rootDir ?? (rootDirConfig.default as string),
    configPath: configPath ?? (configPathConfig.default as string),
    ...rest,
  };
};

/** 获取编译选项 */
export const getCompileOptions = (): CliInfo["options"] => {
  return {
    env: {
      alias: "e",
      describe: "环境数据文件JSON文件相对路径(优先级高于envData)",
      type: "string",
    },
    envData: {
      alias: "E",
      describe: "环境变量数据(JSON字符串)",
      type: "string",
    },
    input: {
      alias: "i",
      describe: "模板文件相对路径(优先级高于inputTemplate)",
      type: "string",
    },
    inputData: {
      alias: "I",
      describe: "模板数据",
      type: "string",
    },
    mode: {
      alias: "m",
      describe: "输出模式",
      type: "string",
      choices: [
        OutputModeEnum.OVERWRITE,
        OutputModeEnum.APPEND,
        OutputModeEnum.REPLACE,
        OutputModeEnum.RETURN,
      ],
      default: defaultCompileOptions.mode,
    },
    output: {
      alias: "o",
      describe: "输出文件路径",
      type: "string",
    },
    rollback: {
      alias: "r",
      describe: "是否回滚",
      type: "boolean",
      default: defaultCompileOptions.rollback,
    },
    dealMarkdown: {
      alias: "d",
      describe: "(检测是markdown)是否处理(单个)代码块包裹",
      type: "boolean",
      default: defaultCompileOptions.dealMarkdown,
    },
    batch: {
      alias: "b",
      describe: "是否批量处理",
      type: "boolean",
      default: defaultCompileOptions.batch,
    },
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
  };
};
