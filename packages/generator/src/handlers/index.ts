/**
 * [T5] 命令分发 + commandCliInfo 装配。
 *
 * 职责（design §1/§4，比照 component/src/handlers/index.ts，但批次类型为运行时 positional）：
 *  - 导出各命令 handler（add/remove/list/init）供 P3 MCP / [P4a] assemble 直接 import（server-agnostic）。
 *  - 装配 commandCliInfo（subcommands）供 main.ts createMainCommand。
 *  - 命令树（yargs 原生 verb-first 路由；`<type>` 作为各命令首位 positional）：
 *      dc-gen add <type> <name> | remove <type> <name> | list [type] | init <type> [--global]
 *    概念用法即 design 的 "dc-gen <type> add <name>"；yargs 子命令按 verb 分发，
 *    故 `<type>` 落为各命令首位 positional（与仓内 component/ai/config 既有 verb-first 范式一致）。
 */
import { handler as addHandler } from "./add";
import { handler as modifyHandler } from "./modify";
import { handler as removeHandler } from "./remove";
import { handler as listHandler } from "./list";
import { handler as initHandler } from "./init";
import { buildBatchQuestions, type BatchQuestion } from "./shared";
import { assembleHandler, type AssembleHandlerResult } from "./assemble";
import injectInfo from "@/injectInfo.json";
import type { GeneratorHandlerArgv } from "@/types";
import type { AssembleAction, AssembleHandlerArgv } from "@/assemble/types";
import {
  createSubcommand,
  getRootScriptName,
  type CliHandlerArgv,
  type CliInfo,
  type SubCliInfo,
  type YargsOptionsRecord,
  type YargsPositionalsRecord,
} from "@done-coding/cli-utils";

export { addHandler, modifyHandler, removeHandler, listHandler, initHandler };
// P4a：assemble handler（server-agnostic，真子命令 plan/build/diff/check）
export { assembleHandler };
export type { AssembleHandlerResult };
// P3：MCP list_questions 工具复用纯函数（无 stdout，design §2/§12 B6）
export { buildBatchQuestions };
export type { BatchQuestion };

const { version, description: describe } = injectInfo;

/** 把 yargs argv 适配为 GeneratorHandlerArgv（保留所有透传字段） */
const toGeneratorArgv = (
  argv: CliHandlerArgv<GeneratorHandlerArgv>,
): GeneratorHandlerArgv => argv as GeneratorHandlerArgv;

/** <type> positional（add/remove/init 首位） */
const typePositional: YargsPositionalsRecord<{ type: string }> = {
  type: { describe: "批次类型", type: "string" },
};

/** <name> positional（add/remove） */
const namePositional: YargsPositionalsRecord<{ name: string }> = {
  name: { describe: "实例名称", type: "string" },
};

/** 非交互供答 + 探针 + skip-missing 选项（modify） */
const modifyOptions: YargsOptionsRecord<
  Pick<
    GeneratorHandlerArgv,
    "env" | "envFile" | "listQuestions" | "skipMissing"
  >
> = {
  env: {
    type: "string",
    describe:
      '非交互供答(JSON)。如 --env \'{"desc":"x"}\'，key 对齐 collectEnvDataForm[].name',
  },
  envFile: {
    type: "string",
    describe: "非交互供答 JSON 文件路径（{ key: value }）",
  },
  listQuestions: {
    type: "boolean",
    describe: "仅打印该批次问题清单(JSON)到 stdout，不落地",
    default: false,
  },
  skipMissing: {
    type: "boolean",
    describe: "跳过不存在的 marker 块（块级），改其余",
    default: false,
  },
};

/** 非交互供答 + 探针选项（add） */
const addOptions: YargsOptionsRecord<
  Pick<GeneratorHandlerArgv, "env" | "envFile" | "listQuestions">
> = {
  env: {
    type: "string",
    describe:
      '非交互供答(JSON)。如 --env \'{"desc":"x"}\'，key 对齐 collectEnvDataForm[].name',
  },
  envFile: {
    type: "string",
    describe: "非交互供答 JSON 文件路径（{ key: value }）",
  },
  listQuestions: {
    type: "boolean",
    describe: "仅打印该批次问题清单(JSON)到 stdout，不落地",
    default: false,
  },
};

/** 非交互供答选项（remove） */
const removeOptions: YargsOptionsRecord<
  Pick<GeneratorHandlerArgv, "env" | "envFile" | "allowDangerous">
> = {
  env: { type: "string", describe: "非交互供答(JSON)，用于复算 remove 落地块" },
  envFile: { type: "string", describe: "非交互供答 JSON 文件路径" },
  allowDangerous: {
    type: "boolean",
    describe:
      "显式放行 removeEmptyDir 在可疑根（家目录本体 / 文件系统根）下 rmdir",
    default: false,
  },
};

/** list -o 选项 */
const listOptions: YargsOptionsRecord<Pick<GeneratorHandlerArgv, "output">> = {
  output: {
    alias: "o",
    type: "string",
    describe: "批次实例 list 序列化输出路径（按 config.listSerializer）",
  },
};

/** init --global 选项 */
const initOptions: YargsOptionsRecord<Pick<GeneratorHandlerArgv, "global">> = {
  global: {
    type: "boolean",
    describe: "写 ~/.done-coding/<type>/ 而非 cwd",
    default: false,
  },
};

const addCommandCliInfo: SubCliInfo = {
  command: "add <type> <name>",
  describe: "新增一个批次实例",
  positionals: { ...typePositional, ...namePositional },
  options: addOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    addHandler(toGeneratorArgv(argv))) as SubCliInfo["handler"],
};

const modifyCommandCliInfo: SubCliInfo = {
  command: "modify <type> <name>",
  describe: "复用配方原位修改 insert 块的值",
  positionals: { ...typePositional, ...namePositional },
  options: modifyOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    modifyHandler(toGeneratorArgv(argv))) as SubCliInfo["handler"],
};

const removeCommandCliInfo: SubCliInfo = {
  command: "remove <type> <name>",
  describe: "删除一个批次实例（反配方）",
  positionals: { ...typePositional, ...namePositional },
  options: removeOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    removeHandler(toGeneratorArgv(argv))) as SubCliInfo["handler"],
};

const listCommandCliInfo: SubCliInfo = {
  command: "list [type]",
  describe: "无 type=批次发现 list；带 type=批次实例 list（-o 落地）",
  positionals: {
    type: { describe: "批次类型（省略=列出所有已发现批次）", type: "string" },
  },
  options: listOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    listHandler(toGeneratorArgv(argv))) as SubCliInfo["handler"],
};

const initCommandCliInfo: SubCliInfo = {
  command: "init <type>",
  describe: "初始化一个批次骨架（index.json + config.json5 + template/）",
  positionals: typePositional,
  options: initOptions,
  handler: ((argv: CliHandlerArgv<GeneratorHandlerArgv>) =>
    initHandler(toGeneratorArgv(argv))) as SubCliInfo["handler"],
};

// ───────────────────────── assemble 真子命令（D-M1，dc-gen assemble <action>） ─────────────────────────

/** assemble 各 action 共享选项（recipe/all/out-dir/against/force/json）。 */
const assembleOptions: YargsOptionsRecord<
  Pick<
    AssembleHandlerArgv,
    | "recipe"
    | "all"
    | "outDir"
    | "against"
    | "forceClean"
    | "allowUntrackedDelete"
    | "allowDangerous"
    | "json"
  >
> = {
  recipe: {
    type: "string",
    describe: "指定配方路径（覆盖约定 assemble/recipes/）",
  },
  all: {
    type: "boolean",
    describe: "批量跑 assemble/recipes/ 下全部配方（output 冲突校验）",
    default: false,
  },
  outDir: {
    type: "string",
    describe: "diff/check 临时落盘根（缺省 os.tmpdir）",
  },
  against: {
    type: "string",
    choices: ["worktree", "head", "index"],
    describe: "diff/check 比对基准（缺省 worktree）",
  },
  forceClean: {
    type: "boolean",
    describe:
      "build 全量清空 output（含 untracked，需 git clean / --allow-untracked-delete）",
    default: false,
  },
  allowUntrackedDelete: {
    type: "boolean",
    describe: "配合 --force-clean 显式放行删除 untracked",
    default: false,
  },
  allowDangerous: {
    type: "boolean",
    describe: "显式放行在可疑根（家目录本体 / 文件系统根）下 build",
    default: false,
  },
  json: {
    type: "boolean",
    describe: "机器可读输出（stdout 洁净 JSON）",
    default: false,
  },
};

/**
 * cli 边界包装：调 assembleHandler → 据返回 exitCode 落 process.exitCode（diff/check drift=1）。
 * 库函数 throw fail-loud（由 yargs failHandler 落 exit 1）；[MUST NOT] 库内 process.exit。
 */
const runAssembleAction =
  (action: AssembleAction) =>
  async (argv: CliHandlerArgv<AssembleHandlerArgv>): Promise<void> => {
    const result = await assembleHandler({
      ...(argv as AssembleHandlerArgv),
      action,
    });
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode;
    }
  };

const assembleActionCliInfo = (
  action: AssembleAction,
  describeText: string,
): SubCliInfo => ({
  command: `assemble ${action}`,
  describe: describeText,
  options: assembleOptions,
  handler: runAssembleAction(action) as SubCliInfo["handler"],
});

const assembleSubcommands: SubCliInfo[] = [
  assembleActionCliInfo("plan", "解析配方→输出有序 op 计划 + 预检（dry-run）"),
  assembleActionCliInfo("build", "组装→clean-regenerate 落 output（入版控）"),
  assembleActionCliInfo(
    "diff",
    "flush 到 tmp→与基准 output 逐字节 diff，漂移 exit 1",
  ),
  assembleActionCliInfo("check", "diff 的 CI 漂移闸别名（drift→exit 1）"),
];

export const commandCliInfo: Omit<CliInfo, "usage"> = {
  describe,
  version,
  subcommands: [
    addCommandCliInfo,
    modifyCommandCliInfo,
    removeCommandCliInfo,
    listCommandCliInfo,
    initCommandCliInfo,
    ...assembleSubcommands,
  ].map(createSubcommand),
  demandCommandCount: 1,
  rootScriptName: getRootScriptName({ packageJson: injectInfo }),
};
