import { SubcommandEnum, getCompileOptions, getInitOptions } from "@/utils";
import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import _curry from "lodash.curry";
import type { CliInfo, SubCliInfo } from "@done-coding/cli-utils";
import { createMainCommand, createSubcommand } from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { moduleName },
} = injectInfo;

const initCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INIT,
  describe: "初始化模板配置文件",
  options: getInitOptions(),
  handler: _curry(handler)(
    SubcommandEnum.INIT,
  ) as unknown as CliInfo["handler"],
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
