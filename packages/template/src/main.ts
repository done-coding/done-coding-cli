import { defaultOptions, OutputModeEnum, SubcommandEnum } from "@/utils";
import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import _curry from "lodash.curry";
import type { CliInfo, SubCliInfo } from "@done-coding/cli-utils";
import { createMainCommand, createSubcommand } from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { namespaceDir, moduleName },
} = injectInfo;

const getInitOptions = (): CliInfo["options"] => {
  return {
    rootDir: {
      type: "string",
      alias: "r",
      describe: "运行目录",
      default: process.cwd(),
    },
    configPath: {
      type: "string",
      alias: "c",
      describe: "配置文件相对路径",
      default: `./${namespaceDir}/${moduleName}.json`,
    },
  };
};

const initCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INIT,
  describe: "初始化模板配置文件",
  options: getInitOptions(),
  handler: _curry(handler)(
    SubcommandEnum.INIT,
  ) as unknown as CliInfo["handler"],
};

const getCompileOptions = (): CliInfo["options"] => {
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
      default: defaultOptions.mode,
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
      default: defaultOptions.rollback,
    },
    dealMarkdown: {
      alias: "d",
      describe: "(检测是markdown)是否处理(单个)代码块包裹",
      type: "boolean",
      default: defaultOptions.dealMarkdown,
    },
    batch: {
      alias: "b",
      describe: "是否批量处理",
      type: "boolean",
      default: defaultOptions.batch,
    },
  };
};

const compileCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.COMPILE,
  describe: "编译模板",
  options: getCompileOptions(),
  handler: _curry(handler)(
    SubcommandEnum.COMPILE,
  ) as unknown as CliInfo["handler"],
};

const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [initCommandCliInfo, compileCommandCliInfo].map((item) =>
    createSubcommand(item),
  ),
  demandCommandCount: 1,
};

/** 分发命令&步骤 */
const dispatchCommandAndUsage = (asSubcommand = false) => {
  const command = asSubcommand ? moduleName : undefined;
  const usage = `$0${asSubcommand ? ` ${moduleName}` : ""} <command> [options]`;
  return { command, usage };
};

/** 作为主命令创建 */
export const createCommand = async () => {
  return createMainCommand({
    ...commandCliInfo,
    ...dispatchCommandAndUsage(),
  });
};

/** 作为子命令创建 */
export const crateAsSubcommand = () => {
  return createSubcommand({
    ...commandCliInfo,
    ...dispatchCommandAndUsage(true),
  } as unknown as SubCliInfo);
};
