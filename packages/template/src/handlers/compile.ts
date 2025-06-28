import { compileTemplate, getData } from "@/utils";
import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { log } from "@done-coding/cli-utils";
import type { CompileOptions, CompilePublicConfig } from "@/types";
import { OutputModeEnum } from "@/types";
import {
  handler as batchHandler,
  getOptions as getBatchOptions,
} from "./batch-compile";

/** 获取编译选项 */
const getOptions = (): YargsOptionsRecord<CompileOptions> => {
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
    output: {
      alias: "o",
      describe: "输出文件路径",
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
      default: OutputModeEnum.OVERWRITE,
    },
    batch: {
      alias: "b",
      describe: "是否批量处理",
      type: "boolean",
      default: false,
    },
    ...getBatchOptions(),
  };
};

/** 编译模板 */
export const handler = async (argv: CliHandlerArgv<CompileOptions>) => {
  const defaultOptions = getOptions();
  const {
    envData: envDataInit,
    env,
    input,
    inputData,
    output,
    mode = defaultOptions.mode.default,
    batch,
    ...publicConfig
  } = argv;

  const {
    rootDir = defaultOptions.rootDir.default,
    rollbackDelNullFile,
    rollbackDelAskAsYes,
    dealMarkdown,
    rollback,
  } = publicConfig as CompilePublicConfig;

  if (batch) {
    log.stage(`开始批量处理`);
    return batchHandler(publicConfig);
  }
  log.stage(`开始单个处理`);

  /** 环境变量 */
  const envData = getData({
    rootDir,
    filePath: env,
    dataInit: envDataInit,
    limitJson: true,
    filePathKey: "env",
    dataInitKey: "envData",
    dealMarkdown,
  });

  return compileTemplate(
    {
      input,
      inputData,
      output,
      mode,
      rollbackDelNullFile,
      rollbackDelAskAsYes,
      dealMarkdown,
      envData,
    },
    {
      rootDir,
      rollback,
    },
  );
};

export const commandCliInfo: SubCliInfo = {
  command: `$0`,
  describe: "编译模板",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
