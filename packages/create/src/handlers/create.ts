import {
  getRemoveDirForm,
  projectNameForm,
  saveGitHistoryForm,
  getTemplateChoices,
  getTemplateForm,
  SOMEONE_PUBLIC_REPO_NAME,
  customUrlForm,
  getGitCommitMessageForm,
} from "@/utils";
import type {
  CliHandlerArgv,
  CliInfo,
  SubCliInfo,
} from "@done-coding/cli-utils";
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import path, { resolve } from "node:path";
import { CUSTOM_TEMPLATE_NAME } from "@/utils";
import {
  getConfigPath,
  batchCompileHandler,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
} from "@done-coding/cli-template";
import { log, lookForParentTarget, xPrompts } from "@done-coding/cli-utils";
import { getTargetRepoUrl } from "@done-coding/cli-git";
import { cloneDoneCodingSeries } from "@done-coding/cli-git/helpers";
import injectInfo from "@/injectInfo.json";
import type { CreateOptions } from "@/types";

const getOptions = (): CliInfo["options"] => {
  return {
    justCloneFromDoneCoding: {
      alias: "c",
      type: "boolean",
      describe: "是否仅仅(从done-coding系列项目列表中)克隆远程仓库",
      default: false,
    },
  };
};

const getPositionals = (): CliInfo["positionals"] => {
  return {
    projectName: {
      describe: "项目名称",
      type: "string",
    },
  };
};

// eslint-disable-next-line complexity
export const handler = async (argv: CliHandlerArgv<CreateOptions>) => {
  log.info(`版本: ${injectInfo.version}`);

  const { projectName: projectNameInit, justCloneFromDoneCoding = true } = argv;

  if (justCloneFromDoneCoding) {
    log.info(`仅仅(从done-coding系列项目列表中)克隆远程仓库`);
    await cloneDoneCodingSeries(projectNameInit);
    return;
  }

  const projectNameNoTrim =
    projectNameInit ?? (await xPrompts(projectNameForm)).projectName;

  const projectName = (projectNameNoTrim || "").trim();

  if (!projectName) {
    log.error(`项目名称不能为空`);
    return process.exit(1);
  }

  if (
    projectName.includes(" ") ||
    projectName.includes("\\") ||
    projectName.includes("/")
  ) {
    log.error(`项目名称\`${projectName}\`不能包含空格或者\\或者/`);
    return process.exit(1);
  }

  const projectNamePath = resolve(process.cwd(), projectName);

  if (existsSync(projectNamePath)) {
    const { isRemove } = await xPrompts(getRemoveDirForm());
    if (isRemove === true) {
      rmSync(projectNamePath, { recursive: true, force: true });
    } else {
      log.error(`项目${projectName}已存在`);
      return process.exit(1);
    }
  }

  const { template } = await xPrompts(await getTemplateForm());

  let remoteUrl = "";
  let templateBranch: string | undefined = "";

  if (template === CUSTOM_TEMPLATE_NAME) {
    const { customUrl } = await xPrompts(customUrlForm);
    remoteUrl = customUrl;
  } else if (template === SOMEONE_PUBLIC_REPO_NAME) {
    remoteUrl = await getTargetRepoUrl();
  } else {
    const target = (await getTemplateChoices()).find(
      (item) => item.name === template,
    );
    if (!target) {
      log.error(`模板${template}不存在`);
      return process.exit(1);
    }
    if (!target.url) {
      log.error(`模板${template}仓库地址不存在`);
      return process.exit(1);
    }
    remoteUrl = target.url;
    if (typeof target.branch === "string") {
      templateBranch = target.branch;
    } else if (Array.isArray(target.branch) && target.branch.length > 0) {
      const { targetBranch } = await xPrompts({
        type: "select",
        name: "targetBranch",
        message: "请选择模板分支",
        choices: target.branch.map((item) => {
          return {
            title: item.name,
            value: item.name,
            description: item.description,
          };
        }),
        // initial: 0,
      });
      templateBranch = targetBranch;
    }
  }

  /** 父级git目录 */
  const parentGitDir = lookForParentTarget(".git");

  log.stage("正在初始化项目，请稍等...");

  execSync(
    `git clone${
      templateBranch ? ` -b ${templateBranch}` : ""
    } ${remoteUrl} ${projectName} --depth=1`,
    { stdio: "inherit" },
  );

  /** 如果有没有父级仓库 且知名了克隆的远程分支 则询问是否需要更改本地分支名 */
  if (!parentGitDir && templateBranch) {
    const { isChangeBranchName } = await xPrompts({
      type: "confirm",
      name: "isChangeBranchName",
      message: `是否要重命名指定克隆分支名(${templateBranch})在本地的分支名`,
      initial: false,
    });

    if (isChangeBranchName) {
      const { localBranchName } = await xPrompts({
        type: "text",
        name: "localBranchName",
        message: "请输入克隆到本地后的分支名",
        initial: "master",
      });
      execSync(`git branch -m ${localBranchName}`);
    }
  }

  const configPath = MODULE_DEFAULT_CONFIG_RELATIVE_PATH;

  const configPathFinal = getConfigPath({
    rootDir: projectNamePath,
    configPath,
  });

  if (configPathFinal) {
    await batchCompileHandler({
      rootDir: projectNamePath,
      configPath: configPath,
      extraEnvData: {
        $projectName: projectName,
      },
    });
    rmSync(configPathFinal, { force: true });

    log.stage("模板项目配置注入成功, 模版项目配置文件已删除");
  }

  log.stage("项目初始化完成");

  if (parentGitDir) {
    /** 当前项目git目录 */
    const currentGitDir = path.resolve(projectNamePath);
    /** 当前项目git信息目录 */
    const currentGitInfoDir = path.resolve(currentGitDir, ".git");

    if (!existsSync(currentGitInfoDir)) {
      throw new Error("git目录不存在");
    }

    rmSync(currentGitInfoDir, { recursive: true, force: true });
    log.stage(
      `项目创建在父级git仓库${parentGitDir}中，已删除${projectName}目录下的.git(${currentGitInfoDir})`,
    );
  } else {
    // 如果项目不在git仓库中，则询问是否保存git历史记录

    const saveGitHistory = (await xPrompts(saveGitHistoryForm)).saveGitHistory;

    if (saveGitHistory) {
      // 保存git记录则重命名origin为upstream 同时完整克隆仓库
      execSync(`git remote rename origin upstream && git fetch --unshallow`, {
        cwd: projectNamePath,
        stdio: "inherit",
      });

      log.stage(
        `已经将origin重命名为upstream，后续可以与模板git仓库有完整的交互`,
      );

      log.success(`已保存git历史记录`);
    } else {
      // 项目git目录
      const projectNameGitPath = path.resolve(projectNamePath, ".git");
      rmSync(projectNameGitPath, { recursive: true, force: true });

      execSync(`git init`, {
        cwd: projectNamePath,
        stdio: "inherit",
      });
    }
  }

  const { gitCommitMessage } = await xPrompts(
    getGitCommitMessageForm(projectName),
  );

  // 提交代码
  execSync(`git add . && git commit -m '${gitCommitMessage}'`, {
    cwd: projectNamePath,
    stdio: "inherit",
  });

  log.success(`项目${projectName}初始化完成`);

  log.info(`
使用步骤: 
  1. cd ${projectName}
  2. pnpm install
  3. pnpm run dev
  `);
};

export const commandCliInfo: SubCliInfo = {
  command: `$0`,
  describe: injectInfo.description,
  options: getOptions(),
  positionals: getPositionals(),
  handler,
};
