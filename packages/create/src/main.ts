/*
 * @Description  :
 * @Author       : JustSoSu
 * @Date         : 2026-02-07 20:24:02
 * @LastEditors  : JustSoSu
 * @LastEditTime : 2026-04-15 12:03:23
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
  // const command = `${asSubcommand ? `${moduleName} ` : ""}[projectName]`;
  const command = `${asSubcommand ? `${moduleName} ` : ""}`;
  const usage = `$0 ${command.trim()}`;
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
