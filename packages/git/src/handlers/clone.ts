/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-21 18:36:43
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 12:38:19
 */
import type {
  CliHandlerArgv,
  CliInfo,
  SubCliInfo,
} from "@done-coding/cli-utils";
import { GitPlatformEnum, SubcommandEnum } from "@/types";
import { execSyncHijack, outputConsole } from "@done-coding/cli-utils";
import type { CloneOptions } from "@/types";
import { getTargetRepoUrl } from "@/utils";

export const getOptions = (): CliInfo["options"] => {
  return {
    projectName: {
      type: "string",
      alias: "p",
      describe: "项目名称",
    },
  };
};

/** 位置参数 */
export const getPositionals = (): CliInfo["positionals"] => {
  return {
    platform: {
      describe: "选择git平台",
      type: "string",
      choices: [GitPlatformEnum.GITHUB, GitPlatformEnum.GITEE],
    },
    username: {
      describe: "git平台用户名",
      type: "string",
    },
  };
};

/** 克隆目标仓库 */
export const handler = async (options: CliHandlerArgv<CloneOptions>) => {
  const repoUrl = await getTargetRepoUrl(options);

  const { projectName } = options;

  execSyncHijack(
    `git clone ${repoUrl} ${projectName ? `${projectName} ` : ""}--depth=1`,
    { stdio: "inherit" },
  );

  outputConsole.success(`克隆${repoUrl}成功`);
};

export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.CLONE} <platform> <username>`,
  describe: "从选择的git平台克隆代码",
  options: getOptions(),
  positionals: getPositionals(),
  handler: handler as SubCliInfo["handler"],
};
