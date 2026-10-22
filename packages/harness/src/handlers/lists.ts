import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { resolveGovernance } from "@/core/config";
import { diffLists, writeLists } from "@/core/lists";
import { SubcommandEnum, type ListsOptions } from "@/types";

/** 治理目录选项（lists / check 共用） */
export const dirOption: YargsOptionsRecord<{ dir?: string }> = {
  dir: {
    type: "string",
    alias: "d",
    describe:
      "治理目录（相对项目根），缺省读 .done-coding/harness/governance/config.json 或 docs/governance",
  },
};

const getOptions = (): YargsOptionsRecord<ListsOptions> => ({
  ...dirOption,
  check: {
    type: "boolean",
    alias: "c",
    describe: "只校验不写盘，清单有差异即退出码 1",
    default: false,
  },
});

/** 重生成治理清单；`--check` 时只比对。返回退出码 */
export const handler = async (argv: CliHandlerArgv<ListsOptions>) => {
  const { root } = resolveGovernance(safeCwd(), argv.dir);
  if (argv.check) {
    const drift = diffLists(root);
    if (drift.length) {
      outputConsole.error(`❌ 清单已漂移：${drift.join(" · ")}`);
      return 1;
    }
    outputConsole.success("✅ 清单与条目一致");
    return 0;
  }
  const changed = writeLists(root);
  outputConsole.info(
    `已重生成：${changed.length ? changed.join(" · ") : "无变化"}`,
  );
  return 0;
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.LISTS,
  describe:
    "从条目 frontmatter 重生成治理清单（BACKLOG / SCHEDULE / ARCHIVE-DONE / DROPPED / ISSUE）",
  options: getOptions(),
  handler: (async (argv: CliHandlerArgv<ListsOptions>) => {
    process.exitCode = await handler(argv);
  }) as SubCliInfo["handler"],
};
