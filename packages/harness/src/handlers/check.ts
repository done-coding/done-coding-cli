import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
} from "@done-coding/cli-utils";
import { runChecks } from "@/core/check";
import { resolveGovernance } from "@/core/config";
import { SubcommandEnum, type CheckOptions } from "@/types";
import { dirOption } from "./lists";

/** 跑治理闸，返回退出码（有违规 = 1） */
export const handler = async (argv: CliHandlerArgv<CheckOptions>) => {
  const { root, domains } = resolveGovernance(safeCwd(), argv.dir);
  const errs = runChecks(root, domains);
  if (errs.length) {
    errs.forEach((e) => outputConsole.error(`❌ ${e}`));
    return 1;
  }
  outputConsole.success("✅ 元闸 / 并行闸 / 收口形态 / 清单 全过");
  return 0;
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.CHECK,
  describe:
    "治理闸：元闸 + 并行闸 + 收口形态 + 清单零 diff（任一不过退出码 1）",
  options: dirOption,
  handler: (async (argv: CliHandlerArgv<CheckOptions>) => {
    process.exitCode = await handler(argv);
  }) as SubCliInfo["handler"],
};
