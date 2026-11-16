import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
} from "@done-coding/cli-utils";
import { resolveGovernance } from "@/core/config";
import { compareCodePoint } from "@/core/fs-entries";
import { assertGitRoot, listTracked } from "@/core/git-files";
import {
  computeOwnership,
  readOwnershipModel,
  type Owner,
} from "@/core/ownership";
import { SubcommandEnum, type OwnersOptions } from "@/types";
import { dirOption } from "./lists";

const getOptions = (): YargsOptionsRecord<OwnersOptions> => ({
  ...dirOption,
  unowned: {
    type: "boolean",
    describe: "只列出无主的代码文件（全部，不截断）",
    default: false,
  },
  json: { type: "boolean", describe: "输出 JSON", default: false },
});

const ownerLabel = (owner?: Owner): string =>
  !owner
    ? "（无主）"
    : owner.kind === "domain"
      ? `领域 ${owner.name}`
      : `共享骨架 ${owner.label}`;

/** 归属查询：各归属的代码文件数 / 无主清单 / 指定文件的归属。返回退出码 */
export const handler = async (argv: CliHandlerArgv<OwnersOptions>) => {
  const cwd = safeCwd();
  const ctx = resolveGovernance(cwd, argv.dir);
  const model = readOwnershipModel(ctx.root, ctx.domains);
  if (!model.hasPaths) {
    outputConsole.error(`❌ ${model.file} 领域表无 paths 列，无从计算归属`);
    return 1;
  }
  assertGitRoot(cwd);
  const result = computeOwnership(model, listTracked(cwd), ctx.ownership);
  const files = (argv.files ?? []).map(String);
  if (files.length) {
    const rows = files.map((file) => ({
      file,
      owner: ownerLabel(result.owners.get(file)),
      code: result.codeFiles.includes(file),
    }));
    if (argv.json) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    else
      rows.forEach((r) =>
        process.stdout.write(
          `${r.file}\t${r.code ? r.owner : "（不算代码文件）"}\n`,
        ),
      );
    return 0;
  }
  if (argv.unowned) {
    if (argv.json)
      process.stdout.write(`${JSON.stringify(result.unowned, null, 2)}\n`);
    else result.unowned.forEach((file) => process.stdout.write(`${file}\n`));
    return result.unowned.length ? 1 : 0;
  }
  const counts = new Map<string, number>();
  for (const owner of result.owners.values()) {
    const label = ownerLabel(owner);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const summary = {
    codeFiles: result.codeFiles.length,
    owners: Object.fromEntries(
      [...counts].sort((a, b) => compareCodePoint(a[0], b[0])),
    ),
    unowned: result.unowned.length,
    skeletonTable: Boolean(model.skeleton),
  };
  if (argv.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(`代码文件 ${summary.codeFiles} 个\n`);
    for (const [label, count] of Object.entries(summary.owners)) {
      process.stdout.write(`  ${label}\t${count}\n`);
    }
    process.stdout.write(`  （无主）\t${summary.unowned}\n`);
    if (!model.skeleton)
      outputConsole.warn("⚠️ 未建共享骨架表：壳文件都会算无主");
  }
  return 0;
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.OWNERS} [files..]`,
  describe:
    "代码归属查询：各领域 / 共享骨架的代码文件数，--unowned 列无主文件，给出文件则逐个答归属",
  options: getOptions(),
  handler: (async (argv: CliHandlerArgv<OwnersOptions>) => {
    process.exitCode = await handler(argv);
  }) as SubCliInfo["handler"],
};
