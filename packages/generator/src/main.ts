/**
 * [T3 骨架] 由 Wave B T5 实现 <命令工厂：createMainCommand / createAsSubcommand>。
 *
 * 比照 component/create main.ts，复用 cli-utils createMainCommand/createSubcommand。
 * dc-generator 为主命令；批次类型是运行时 positional（<type>），非 injectInfo.moduleName 固定值。
 */
import { commandCliInfo } from "@/handlers";
import injectInfo from "@/injectInfo.json";
import type { SubCliInfo } from "@done-coding/cli-utils";
import { createMainCommand, createSubcommand } from "@done-coding/cli-utils";

const {
  cliConfig: { moduleName },
} = injectInfo;

/** 分发命令 & 用法（M3：verb-first——动词在前 <type> 在后） */
const dispatchCommandAndUsage = (asSubcommand = false) => {
  const command = asSubcommand ? moduleName : undefined;
  const prefix = `$0${asSubcommand ? ` ${moduleName}` : ""}`;
  const usage = `${prefix} <command> [<type>] [<name>] [options]
  ${prefix} add <type> <name>            添加实例
  ${prefix} add <type> --list-questions  列出该批次问题清单
  ${prefix} modify <type> <name>         原位修改 insert 块的值
  ${prefix} remove <type> <name>         移除实例
  ${prefix} list [type]                  列出批次（无 type）/ 批次实例（带 type）
  ${prefix} init <type>                  初始化批次骨架
  ${prefix} assemble plan|build|diff|check  模板组装（配方→物化产物 + 漂移闸）`;
  return { command, usage };
};

/** 作为主命令创建（bin dc-generator） */
export const createCommand = async () => {
  return createMainCommand({
    ...commandCliInfo,
    ...dispatchCommandAndUsage(),
  });
};

/** 作为子命令创建 */
export const createAsSubcommand = () => {
  return createSubcommand({
    ...commandCliInfo,
    ...dispatchCommandAndUsage(true),
  } as unknown as SubCliInfo);
};
