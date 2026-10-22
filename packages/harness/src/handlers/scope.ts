import { execFileSync } from "node:child_process";
import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { resolveGovernance } from "@/core/config";
import { checkScope, getScopeDir, readScope, registerRepo } from "@/core/scope";
import { ScopeActionEnum, SubcommandEnum, type ScopeOptions } from "@/types";

/** 当前目录所属 git 仓根 */
const repoRootOf = (cwd: string): string =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf-8",
  }).trim();

/** 列出登记；--inbox 只列收 issue 的仓；--json 输出数组 */
const list = (argv: ScopeOptions) => {
  const entries = readScope()
    .map((r) => r.entry)
    .filter((e) => !argv.inbox || Boolean(e.governance?.issueInbox));
  if (argv.json) {
    process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
    return 0;
  }
  if (!entries.length) {
    outputConsole.info(`注册表为空：${getScopeDir()}`);
    return 0;
  }
  for (const e of entries) {
    const inbox = e.governance?.issueInbox ? "收 issue" : "不收 issue";
    outputConsole.info(`${e.name}（${inbox}）${e.path}\n  ${e.positioning}`);
  }
  return 0;
};

/** 校验注册表，有违规退出码 1 */
const check = () => {
  const errs = checkScope();
  if (errs.length) {
    errs.forEach((e) => outputConsole.error(`❌ ${e}`));
    return 1;
  }
  outputConsole.success(`✅ 注册表校验通过：${getScopeDir()}`);
  return 0;
};

/** 登记 / 更新当前 git 仓 */
const register = (argv: ScopeOptions) => {
  const repoRoot = repoRootOf(safeCwd());
  let governanceRoot: string | undefined;
  try {
    governanceRoot = resolveGovernance(repoRoot, argv.dir).root;
  } catch {
    governanceRoot = undefined; // 未建治理目录 → governance 记 null
  }
  const entry = registerRepo({
    repoRoot,
    governanceRoot,
    name: argv.name,
    positioning: argv.positioning,
    accepts: argv.accepts,
    tier: argv.tier,
  });
  if (!entry.positioning) {
    outputConsole.warn("positioning 为空：用 --positioning 补一句定位");
  }
  outputConsole.success(
    `已登记 ${entry.name} → ${entry.path}（${entry.governance?.issueInbox ? "收 issue" : "不收 issue"}）`,
  );
  return 0;
};

/** scope 各动作入口，返回退出码 */
export const handler = async (argv: CliHandlerArgv<ScopeOptions>) => {
  switch (argv.action) {
    case ScopeActionEnum.LIST:
      return list(argv);
    case ScopeActionEnum.CHECK:
      return check();
    case ScopeActionEnum.REGISTER:
      return register(argv);
    default:
      throw new Error(`不支持的 scope 动作 ${String(argv.action)}`);
  }
};

const listOptions: YargsOptionsRecord<Pick<ScopeOptions, "inbox" | "json">> = {
  inbox: {
    type: "boolean",
    describe: "只列开了 issue 收件箱的仓",
    default: false,
  },
  json: { type: "boolean", describe: "输出 JSON", default: false },
};

const registerOptions: YargsOptionsRecord<
  Pick<ScopeOptions, "name" | "positioning" | "accepts" | "tier" | "dir">
> = {
  name: { type: "string", alias: "n", describe: "仓名，缺省仓根目录名" },
  positioning: { type: "string", alias: "p", describe: "一句话定位" },
  accepts: { type: "string", alias: "a", describe: "受理范围" },
  tier: { type: "string", describe: "治理裁剪档位" },
  dir: { type: "string", describe: "治理目录（相对仓根）" },
};

const actionCliInfo = (
  action: ScopeActionEnum,
  describe: string,
  options: YargsOptionsRecord<any> = {},
): SubCliInfo => ({
  command: `${SubcommandEnum.SCOPE} ${action}`,
  describe,
  options,
  handler: (async (argv: CliHandlerArgv<ScopeOptions>) => {
    process.exitCode = await handler({ ...argv, action });
  }) as SubCliInfo["handler"],
});

export const commandCliInfos: SubCliInfo[] = [
  actionCliInfo(
    ScopeActionEnum.LIST,
    "列出仓库注册表（~/.done-coding/harness/scope）登记的仓",
    listOptions,
  ),
  actionCliInfo(
    ScopeActionEnum.CHECK,
    "校验注册表：字段 / path 存在 / 目录名与 path 键一致 / 收件箱存在 / name 唯一",
  ),
  actionCliInfo(
    ScopeActionEnum.REGISTER,
    "把当前 git 仓登记进注册表（已登记则更新；撞键拒绝覆盖）",
    registerOptions,
  ),
];
