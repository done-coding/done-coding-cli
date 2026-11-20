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

/** 治理目录各闸的报错前缀 → 闸名（runChecks 的报错都以「<前缀>：」开头） */
const BASE_GATES: [prefix: string, label: string][] = [
  ["元闸", "元闸"],
  ["并行闸", "并行闸"],
  ["批次串", "并行闸"],
  ["收口", "收口形态"],
  ["清单", "清单"],
];

/** 一道执行过的闸及其违规 */
interface GateTally {
  label: string;
  errors: string[];
}

/** 治理目录各闸按前缀归组（顺序固定，没有违规的也列出） */
const tallyBase = (errors: string[]): GateTally[] => {
  const tallies = [...new Set(BASE_GATES.map(([, label]) => label))].map(
    (label): GateTally => ({ label, errors: [] }),
  );
  const other: GateTally = { label: "其他", errors: [] };
  for (const error of errors) {
    const label = BASE_GATES.find(([prefix]) =>
      error.startsWith(`${prefix}：`),
    )?.[1];
    (tallies.find((t) => t.label === label) ?? other).errors.push(error);
  }
  return other.errors.length ? [...tallies, other] : tallies;
};

/**
 * 有违规时也列出通过的闸与各闸违规条数：
 * 只打 ❌ 会让「通过」和「没跑」分不清，收之前 / 收之后的读数也没处记。
 */
export const summarizeGates = (
  tallies: GateTally[],
): { passed?: string; failed: string } => {
  const passed = tallies.filter((t) => !t.errors.length).map((t) => t.label);
  const failed = tallies
    .filter((t) => t.errors.length)
    .map((t) => `${t.label}（${t.errors.length}）`);
  return {
    passed: passed.length ? `✅ 通过：${passed.join(" / ")}` : undefined,
    failed: `❌ 未通过：${failed.join(" / ")}`,
  };
};

/** 跑治理闸，返回退出码（有违规 = 1） */
export const handler = async (argv: CliHandlerArgv<CheckOptions>) => {
  const cwd = safeCwd();
  const ctx = resolveGovernance(cwd, argv.dir);
  const tallies = tallyBase(runChecks(ctx.root, ctx.domains));
  if (ctx.instructions?.gate === true) {
    tallies.push({
      label: "指令闸",
      errors: runInstructions(cwd, ctx.instructions).errors,
    });
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
    if (report.state === "ran") tallies.push({ label, errors: report.errors });
    else if (report.state === "disabled") {
      notices.push(`⚠️ ${label}未启用：${report.note}`);
    } else notices.push(`⚠️ ${label}已关闭：${report.note}`);
    if (report.state === "ran" && report.note) {
      notices.push(`ℹ️ ${label}：${report.note}`);
    }
  }
  const errs = tallies.flatMap((t) => t.errors);
  if (errs.length) {
    errs.forEach((e) => outputConsole.error(`❌ ${e}`));
    const summary = summarizeGates(tallies);
    if (summary.passed) outputConsole.success(summary.passed);
    outputConsole.error(summary.failed);
    notices.forEach((n) => outputConsole.warn(n));
    return 1;
  }
  outputConsole.success(`✅ ${tallies.map((t) => t.label).join(" / ")} 全过`);
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
