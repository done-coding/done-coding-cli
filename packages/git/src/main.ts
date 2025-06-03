import {
  SubcommandEnum,
  getCloneOptions,
  getClonePositionals,
  getInitOptions,
} from "@/utils";
import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import type { CliInfo, SubCliInfo } from "@done-coding/cli-utils";
import {
  createMainCommand,
  createSubcommand,
  _curry,
} from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { moduleName },
} = injectInfo;

const initCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.INIT,
  describe: "初始化git配置文件",
  options: getInitOptions(),
  handler: _curry(handler)(
    SubcommandEnum.INIT,
  ) as unknown as CliInfo["handler"],
};

/** clone cli信息 */
const cloneCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.CLONE} <platform> <username>`,
  describe: "从选择的git平台克隆代码",
  options: getCloneOptions(),
  positionals: getClonePositionals(),
  handler: _curry(handler)(
    SubcommandEnum.CLONE,
  ) as unknown as CliInfo["handler"],
};

const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [initCommandCliInfo, cloneCommandCliInfo].map(createSubcommand),
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
