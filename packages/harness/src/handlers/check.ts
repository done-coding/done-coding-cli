import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { runInstructions } from "@/core/instructions";
import { runChecks } from "@/core/check";
import { resolveGovernance } from "@/core/config";
import { CODE_GATE_LABEL, runCodeGates } from "@/core/gates";
import { SubcommandEnum, type CheckOptions } from "@/types";
import { dirOption } from "./lists";

const getOptions = (): YargsOptionsRecord<CheckOptions> => ({
  ...dirOption,
  strict: {
    type: "boolean",
    describe:
      "归属闸 / 引用闸 / 缺口表闸一律视为必须启用：缺数据即失败（忽略配置 gates）",
    default: false,
  },
});

/** 跑治理闸，返回退出码（有违规 = 1） */
export const handler = async (argv: CliHandlerArgv<CheckOptions>) => {
  const cwd = safeCwd();
  const ctx = resolveGovernance(cwd, argv.dir);
  const errs = runChecks(ctx.root, ctx.domains);
  const passed = ["元闸", "并行闸", "收口形态", "清单"];
  if (ctx.instructions?.gate === true) {
    errs.push(...runInstructions(cwd, ctx.instructions).errors);
    passed.push("指令闸");
  }
  const reports = runCodeGates({
    projectRoot: cwd,
    governanceRoot: ctx.root,
    domains: ctx.domains,
    gates: ctx.gates,
    ownership: ctx.ownership,
    imports: ctx.imports,
    strict: argv.strict,
  });
  const notices: string[] = [];
  for (const report of reports) {
    const label = CODE_GATE_LABEL[report.gate];
    errs.push(...report.errors);
    if (report.state === "ran") passed.push(label);
    else if (report.state === "disabled") {
      notices.push(`⚠️ ${label}未启用：${report.note}`);
    } else notices.push(`⚠️ ${label}已关闭：${report.note}`);
    if (report.state === "ran" && report.note) {
      notices.push(`ℹ️ ${label}：${report.note}`);
    }
  }
  if (errs.length) {
    errs.forEach((e) => outputConsole.error(`❌ ${e}`));
    notices.forEach((n) => outputConsole.warn(n));
    return 1;
  }
  outputConsole.success(`✅ ${passed.join(" / ")} 全过`);
  notices.forEach((n) => outputConsole.warn(n));
  return 0;
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.CHECK,
  describe:
    "治理闸：元闸 + 并行闸 + 收口形态 + 清单零 diff，及有数据时的归属 / 引用 / 缺口表闸（任一不过退出码 1）",
  options: getOptions(),
  handler: (async (argv: CliHandlerArgv<CheckOptions>) => {
    process.exitCode = await handler(argv);
  }) as SubCliInfo["handler"],
};
