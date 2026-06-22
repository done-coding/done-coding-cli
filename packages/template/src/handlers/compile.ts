import { compileTemplate, getData } from "@/utils";
import type {
  CliHandlerArgv,
  SubCliInfo,
  YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { outputConsole } from "@done-coding/cli-utils";
import type { CompileOptions, CompilePublicConfig } from "@/types";
import { OutputModeEnum } from "@/types";
import {
  handler as batchHandler,
  getOptions as getBatchOptions,
} from "./batch-compile";
import { DEFAULT_MARKER_NS } from "@/utils/marker";

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
    outputConsole.stage(`开始批量处理`);
    return batchHandler({ ...publicConfig, markerNs: DEFAULT_MARKER_NS });
  }
  outputConsole.stage(`开始单个处理`);

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

  // 不传 markerNs 是有意的：单发 compile 的 mode choices（OVERWRITE/APPEND/REPLACE/RETURN，见上方
  // options 定义）不含 INSERT，故永远进不了引擎的 INSERT/回退分支（markerNs 必填的唯一路径）。
  // [MUST NOT] 在此补 markerNs“修 bug”——会误导后人以为单发支持 INSERT；INSERT 仅经 --batch。
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
