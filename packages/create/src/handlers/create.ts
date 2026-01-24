import {
  getRemoveDirForm,
  projectNameForm,
  saveGitHistoryForm,
  getTemplateChoices,
  getTemplateForm,
  SOMEONE_PUBLIC_REPO_NAME,
  customUrlForm,
  getGitCommitMessageForm,
  transHttp2SshUrlForm,
  CUSTOM_TEMPLATE_NAME,
  getIsChangeBranchName,
  localBranchNameForm,
  getTemplateGitBranchForm,
} from "@/utils";
import type {
  CliHandlerArgv,
  CliInfo,
  SubCliInfo,
} from "@done-coding/cli-utils";
import { rmSync, existsSync } from "node:fs";
import path, { resolve } from "node:path";
import {
  getConfigPath,
  batchCompileHandler,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
} from "@done-coding/cli-template";
import {
  http2sshGitUrl,
  isHttpGitUrl,
  log,
  lookForParentTarget,
  rmGitCtrlAsync,
  execSyncWithLogDispatch,
  isMcpMode,
  getSafePath,
  generateGetAnswerSwiftFn,
} from "@done-coding/cli-utils";
import { getTargetRepoUrl } from "@done-coding/cli-git";
import { cloneDoneCodingSeries } from "@done-coding/cli-git/helpers";
import injectInfo from "@/injectInfo.json";
import {
  FormNameEnum,
  GitRemoteRepoAliasNameEnum,
  type CreateOptions,
} from "@/types";

const getOptions = (): CliInfo["options"] => {
  return {
    justCloneFromDoneCoding: {
      alias: "c",
      type: "boolean",
      describe: "是否仅仅(从done-coding系列项目列表中)克隆远程仓库",
      default: false,
      hidden: true,
    },
    [FormNameEnum.TEMPLATE_GIT_PATH]: {
      type: "string",
      describe: "模板仓库地址(如果设置 则不会去拉模板列表)",
    },
    [FormNameEnum.TEMPLATE_GIT_BRANCH]: {
      type: "string",
      describe: "模板仓库分支(不指定则是默认分支)",
    },
    simple: {
      type: "boolean",
      describe: "是否精简模式(仓库克隆完后不再询问后续细节操作策略)",
      default: true,
    },
    [FormNameEnum.IS_CHANGE_BRANCH_NAME]: {
      type: "boolean",
      describe: "(如果非精简模式，且需要更改分支名)是否更改分支名",
      default: false,
    },
    [FormNameEnum.LOCAL_BRANCH_NAME]: {
      type: "string",
      describe: "(如果非精简模式，且需要更改分支名)本地分支名",
    },
    [FormNameEnum.IS_SAVE_GIT_HISTORY]: {
      type: "boolean",
      describe: "(如果非精简模式)是否保存模板仓库git历史记录",
      default: false,
    },
    [FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL]: {
      type: "boolean",
      describe: "(如果非精简模式)是否将http url转换为ssh url",
    },
    [FormNameEnum.GIT_COMMIT_MESSAGE]: {
      alias: "m",
      type: "string",
      describe: "(如果非精简模式)git提交信息预设值",
    },
  };
};

const getPositionals = (): CliInfo["positionals"] => {
  return {
    [FormNameEnum.PROJECT_NAME]: {
      describe: "项目名称",
      type: "string",
    },
  };
};

// eslint-disable-next-line complexity
export const handler = async (argv: CliHandlerArgv<CreateOptions>) => {
  // eslint-disable-next-line no-restricted-syntax
  console.log(process.env);
  /** 是否mcp模式 */
  const isMCP = isMcpMode();

  log.info(`版本: ${injectInfo.version}`);

  const {
    [FormNameEnum.PROJECT_NAME]: projectNameInit,
    justCloneFromDoneCoding,
  } = argv;

  // !!! mcp不考虑克隆模式 justCloneFromDoneCoding【默认值为false 即不更改】
  if (justCloneFromDoneCoding) {
    log.info(`仅仅(从done-coding系列项目列表中)克隆远程仓库`);
    await cloneDoneCodingSeries(projectNameInit);
    return;
  }

  const getAnswerSwift = generateGetAnswerSwiftFn({
    isMCP,
    presetAnswer: argv,
  });

  // const projectNameNoTrim = projectNameInit ?? (await xPrompts(projectNameForm))[FormNameEnum.PROJECT_NAME]
  const projectNameNoTrim = await getAnswerSwift(
    FormNameEnum.PROJECT_NAME,
    projectNameForm,
    projectNameInit,
  );

  let projectName = projectNameNoTrim?.trim();

  if (!projectName) {
    log.error(`项目名称不能为空`);
    return process.exit(1);
  }

  // 安全路径名
  const projectNameSafe = getSafePath(projectName);

  // 如果安全路径与原始路径不一致，则提示用户并自动转换
  if (projectNameSafe !== projectName) {
    log.warn(
      `项目名称\`${projectName}\`包含非法字符，已自动转换为\`${projectNameSafe}\``,
    );
    projectName = projectNameSafe;
  }

  // 项目路径
  const projectNamePath = resolve(process.cwd(), projectName);

  // 检测是否同名文件存在
  if (existsSync(projectNamePath)) {
    // !!! mcp直接报错 不替用户决定删除与不删除
    if (isMCP) {
      log.error(`项目${projectName}已存在`);
      return process.exit(1);
    }

    // const isRemove = (await xPrompts(getRemoveDirForm()))[FormNameEnum.IS_REMOVE_SAME_NAME_DIR]
    // !!! 是否删除 不设默认值 即不帮用户决定删除与否
    const isRemove = await getAnswerSwift<boolean>(
      FormNameEnum.IS_REMOVE_SAME_NAME_DIR,
      getRemoveDirForm(),
    );

    if (isRemove === true) {
      rmSync(projectNamePath, { recursive: true, force: true });
    } else {
      log.error(`项目${projectName}已存在`);
      return process.exit(1);
    }
  }

  // 获取远程地址/分支
  let remoteUrl: string | undefined = await getAnswerSwift(
    FormNameEnum.TEMPLATE_GIT_PATH,
  );
  let templateBranch: string | undefined = await getAnswerSwift(
    FormNameEnum.TEMPLATE_GIT_BRANCH,
  );

  // 如果入参未设置 仓库地址 则拉取模板 同时如果模板配置分支多选 也会更新
  if (!remoteUrl) {
    // const template = (await xPrompts(
    //   await getTemplateForm(),
    // ))[FormNameEnum.TEMPLATE];
    const template = await getAnswerSwift<string>(
      FormNameEnum.TEMPLATE,
      await getTemplateForm(),
    );

    // 获取最终 模板仓库地址及分支名
    if (template === CUSTOM_TEMPLATE_NAME) {
      // remoteUrl =
      //   (await xPrompts(customUrlForm))[FormNameEnum.CUSTOM_GIT_URL_INPUT];

      remoteUrl = await getAnswerSwift<string>(
        FormNameEnum.CUSTOM_GIT_URL_INPUT,
        customUrlForm,
      );
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
        // templateBranch = (await xPrompts(getTemplateGitBranchForm(target.branch)))[FormNameEnum.TEMPLATE_GIT_BRANCH];
        templateBranch = await getAnswerSwift(
          FormNameEnum.TEMPLATE_GIT_BRANCH,
          getTemplateGitBranchForm(target.branch),
        );
      }
    }
  }

  if (!remoteUrl) {
    log.error(`模板仓库地址不存在`);
    return process.exit(1);
  }

  /** 父级git目录 */
  const parentGitDir = lookForParentTarget(".git");

  log.stage("正在初始化项目，请稍等...");

  execSyncWithLogDispatch(
    `git clone${
      templateBranch ? ` -b ${templateBranch}` : ""
    } ${remoteUrl} ${projectName} --depth=1`,
    { stdio: "inherit" },
  );

  /** 非简洁模式 且 如果有没有父级仓库 且知名了克隆的远程分支 则询问是否需要更改本地分支名 */
  if (!argv.simple && !parentGitDir && templateBranch) {
    // const isChangeBranchName = (await xPrompts(getIsChangeBranchName(templateBranch)))[FormNameEnum.IS_CHANGE_BRANCH_NAME];
    const isChangeBranchName = await getAnswerSwift<boolean>(
      FormNameEnum.IS_CHANGE_BRANCH_NAME,
      getIsChangeBranchName(templateBranch),
    );

    if (isChangeBranchName) {
      // const { localBranchName } = (await xPrompts(localBranchNameForm))[FormNameEnum.LOCAL_BRANCH_NAME];
      const localBranchName = await getAnswerSwift<string>(
        FormNameEnum.LOCAL_BRANCH_NAME,
        localBranchNameForm,
      );

      execSyncWithLogDispatch(`git branch -m ${localBranchName}`, {
        cwd: projectNamePath,
        stdio: "inherit",
      });
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

  // 简洁模式 - 此处结束 - 移除git控制退出
  if (argv.simple) {
    log.stage(`移除克隆仓库的git控制`);
    await rmGitCtrlAsync(projectNamePath);
    return process.exit(0);
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

    // const saveGitHistory = (await xPrompts(saveGitHistoryForm))[
    //   FormNameEnum.IS_SAVE_GIT_HISTORY
    // ];

    const saveGitHistory = await getAnswerSwift<boolean>(
      FormNameEnum.IS_SAVE_GIT_HISTORY,
      saveGitHistoryForm,
    );

    if (saveGitHistory) {
      // 保存git记录则重命名origin为upstream 同时完整克隆仓库
      execSyncWithLogDispatch(
        `git remote rename ${GitRemoteRepoAliasNameEnum.ORIGIN} ${GitRemoteRepoAliasNameEnum.UPSTREAM} && git fetch --unshallow`,
        {
          cwd: projectNamePath,
          stdio: "inherit",
        },
      );

      log.stage(
        `已经将origin重命名为upstream，后续可以与模板git仓库有完整的交互`,
      );

      log.success(`已保存git历史记录`);

      if (isHttpGitUrl(remoteUrl)) {
        const sshUrl = http2sshGitUrl(remoteUrl);
        // const isTransToSshUrl = (
        //   await xPrompts(
        //     transHttp2SshUrlForm({
        //       httpUrl: remoteUrl,
        //       sshUrl,
        //     }),
        //   )
        // )[FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL];
        const isTransToSshUrl = await getAnswerSwift<boolean>(
          FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL,
          transHttp2SshUrlForm({
            httpUrl: remoteUrl,
            sshUrl,
          }),
        );
        if (isTransToSshUrl) {
          execSyncWithLogDispatch(
            `git remote set-url ${GitRemoteRepoAliasNameEnum.UPSTREAM} ${sshUrl}`,
            {
              cwd: projectNamePath,
              stdio: "inherit",
            },
          );
        }
        log.success(`已将模板远程仓库地址更换为${sshUrl}`);
      }
    } else {
      // 项目git目录
      // const projectNameGitPath = path.resolve(projectNamePath, ".git");
      // rmSync(projectNameGitPath, { recursive: true, force: true });

      await rmGitCtrlAsync(projectNamePath);

      execSyncWithLogDispatch(`git init`, {
        cwd: projectNamePath,
        stdio: "inherit",
      });
    }
  }

  // const gitCommitMessage =
  //   (await xPrompts(getGitCommitMessageForm(projectName)))[FormNameEnum.GIT_COMMIT_MESSAGE];
  const gitCommitMessage = await getAnswerSwift<string>(
    FormNameEnum.GIT_COMMIT_MESSAGE,
    getGitCommitMessageForm(projectName),
  );

  // 提交代码
  execSyncWithLogDispatch(`git add . && git commit -m '${gitCommitMessage}'`, {
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
