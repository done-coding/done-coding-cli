import fs from "node:fs";
import path from "node:path";
import {
  outputConsole,
  safeCwd,
  type CliHandlerArgv,
  type SubCliInfo,
  type YargsOptionsRecord,
  type YargsPositionalsRecord,
} from "@done-coding/cli-utils";
import { fileIssue, getRepoName } from "@/core/issue";
import { resolveIssueTarget } from "@/core/scope";
import { SubcommandEnum, type IssueOptions } from "@/types";

const positionals: YargsPositionalsRecord<Pick<IssueOptions, "target">> = {
  target: {
    describe: "目标仓：仓根目录，或仓库注册表中的仓名",
    type: "string",
  },
};

const getOptions = (): YargsOptionsRecord<Omit<IssueOptions, "target">> => ({
  title: {
    type: "string",
    alias: "t",
    describe: "标题（单行）",
    demandOption: true,
  },
  slug: {
    type: "string",
    alias: "s",
    describe: "语义 slug（小写字母数字，- 连接）",
    demandOption: true,
  },
  bodyFile: {
    type: "string",
    alias: "b",
    describe: "正文文件：现象 + 复现路径",
    demandOption: true,
  },
  from: {
    type: "string",
    alias: "f",
    describe: "来源仓名，缺省取当前 git 仓目录名",
  },
});

/** 向目标仓收件箱提 issue 并在目标仓提交（只含 issue 文件与 ISSUE.md） */
export const handler = async (argv: CliHandlerArgv<IssueOptions>) => {
  const cwd = safeCwd();
  const result = fileIssue({
    targetRoot: resolveIssueTarget(argv.target, cwd),
    from: argv.from ?? getRepoName(cwd),
    title: argv.title,
    slug: argv.slug,
    body: fs.readFileSync(path.resolve(cwd, argv.bodyFile), "utf-8"),
  });
  if (result.homeReplacements > 0) {
    outputConsole.info(
      `已将 ${result.homeReplacements} 处本机家目录路径替换为 ~`,
    );
  }
  outputConsole.success(
    `已提 issue ${result.id} → ${result.file}（目标仓提交 ${result.sha}）`,
  );
  return result;
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.ISSUE} <target>`,
  describe:
    "跨仓提 issue：写入目标仓 issue/、重生其 ISSUE.md、只提交这两个文件",
  positionals,
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
