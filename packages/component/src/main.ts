import { SubcommandEnum } from "@/utils";
import { handler } from "@/handler";
import injectInfo from "@/injectInfo.json";
import type { CliInfo, SubCliInfo } from "@done-coding/cli-utils";
import {
  createMainCommand,
  createSubcommand,
  _curry,
  getRootScriptName,
} from "@done-coding/cli-utils";

const {
  version,
  description: describe,
  cliConfig: { moduleName },
} = injectInfo;

/** 新增组件cli信息 */
const addCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.ADD} <name>`,
  describe: "新增一个组件",
  positionals: {
    name: {
      describe: "组件名称",
      type: "string",
    },
  },
  handler: _curry(handler)(SubcommandEnum.ADD),
};

/** 删除组件cli信息 */
const removeCommandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.REMOVE} [name]`,
  describe: "删除一个组件",
  positionals: {
    name: {
      describe: "组件名称",
      type: "string",
    },
  },
  handler: _curry(handler)(SubcommandEnum.REMOVE),
};

/** 展示组件列表cli信息 */
const listCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.LIST,
  describe: "展示组件列表",
  handler: _curry(handler)(SubcommandEnum.LIST),
};

const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [
    addCommandCliInfo,
    removeCommandCliInfo,
    listCommandCliInfo,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
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
