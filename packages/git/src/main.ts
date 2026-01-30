/*
 * @Description  : git 命令行工具
 * @Author       : supengfei
 * @Date         : 2025-06-18 20:46:25
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-30 07:27:18
 */
import { commandCliInfo } from "@/handlers";
import injectInfo from "@/injectInfo.json";
import type { SubCliInfo } from "@done-coding/cli-utils";
import { createMainCommand, createSubcommand } from "@done-coding/cli-utils";

const {
  cliConfig: { moduleName },
} = injectInfo;

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
    // git 子命令不显示描述信息 即不在父命令的描述信息中显示
    describe: false,
  } as unknown as SubCliInfo);
};
