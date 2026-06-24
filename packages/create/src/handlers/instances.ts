import { outputConsole } from "@done-coding/cli-utils";
import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { listInstances, pruneInstances } from "@/utils";

/**
 * `dc create instances <action>` 子命令：本机创建实例的枚举与清理。
 * ---
 * 读中央注册表 `~/.done-coding/create/instances.json`（单文件，零项目扫描）。
 *   - ls：列出全部实例；path 已不存在的标 `(missing)`。
 *   - prune：移除 path 已不存在的条目。
 */

interface InstancesActionArgv {
  /** 动作：ls | prune */
  action?: string;
}

/** ls：逐条打印实例（path / template / createdAt|(missing)） */
export const instancesLsHandler = () => {
  const list = listInstances();
  if (list.length === 0) {
    outputConsole.info("暂无本机创建实例记录");
    return list;
  }
  for (const item of list) {
    const tail = item.missing ? "(missing)" : item.createdAt;
    outputConsole.info(`${item.path}  ${item.template}  ${tail}`);
  }
  return list;
};

/** prune：清理失效（path 不存在）条目 */
export const instancesPruneHandler = () => {
  const result = pruneInstances();
  outputConsole.info(
    `已清理 ${result.removed} 条失效实例，保留 ${result.kept} 条`,
  );
  return result;
};

/** instances <action> 命令分发 */
const instancesHandler = (argv: CliHandlerArgv<InstancesActionArgv>) => {
  switch (argv.action) {
    case "ls":
      return instancesLsHandler();
    case "prune":
      return instancesPruneHandler();
    default:
      outputConsole.error(`未知的 instances 动作: ${argv.action ?? "(空)"}`);
      outputConsole.info("可用动作: ls | prune");
      return process.exit(1);
  }
};

/** instances 子命令配置 */
export const instancesCommandCliInfo: SubCliInfo = {
  command: "instances <action>",
  describe: "本机创建实例：ls 枚举 / prune 清理失效条目",
  handler: ((argv: CliHandlerArgv<InstancesActionArgv>) => {
    instancesHandler(argv);
  }) as SubCliInfo["handler"],
};
