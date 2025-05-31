import {
  getRemoveDirForm,
  projectNameForm,
  saveGitHistoryForm,
  getTemplateChoices,
  getTemplateForm,
  type Options,
  SOMEONE_PUBLIC_REPO_NAME,
  customUrlForm,
  getGitCommitMessageForm,
} from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { CUSTOM_TEMPLATE_NAME } from "@/utils";
import { getConfigPath, batchHandler } from "@done-coding/cli-template";
import { lookForParentTarget, xPrompts } from "@done-coding/cli-utils";
import { getTargetRepoUrl } from "@done-coding/cli-git";

// eslint-disable-next-line complexity
export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
  const { projectName: projectNameInit } = argv;
  const projectNameNoTrim =
    projectNameInit ?? (await xPrompts(projectNameForm)).projectName;

  const projectName = (projectNameNoTrim || "").trim();

  if (!projectName) {
    console.log(chalk.red("项目名称不能为空"));
    return process.exit(1);
  }

  if (
    projectName.includes(" ") ||
    projectName.includes("\\") ||
    projectName.includes("/")
  ) {
    console.log(chalk.red(`项目名称\`${projectName}\`不能包含空格或者\\或者/`));
    return process.exit(1);
  }

  const projectNamePath = resolve(process.cwd(), projectName);

  if (existsSync(projectNamePath)) {
    const { isRemove } = await xPrompts(getRemoveDirForm());
    if (isRemove === true) {
      rmSync(projectNamePath, { recursive: true, force: true });
    } else {
      console.log(chalk.red("项目已存在"));
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
      console.log(chalk.red(`模板${template}不存在`));
      return process.exit(1);
    }
    if (!target.url) {
      console.log(chalk.red(`模板${template}仓库地址不存在`));
      return process.exit(1);
    }
    remoteUrl = target.url;
    templateBranch = target.branch;
  }

  /** 父级git目录 */
  const parentGitDir = lookForParentTarget(".git");

  console.log(chalk.blue("正在初始化项目，请稍等..."));

  execSync(
    `git clone${
      templateBranch ? ` -b ${templateBranch}` : ""
    } ${remoteUrl} ${projectName} --depth=1`,
    { stdio: "inherit" },
  );

  const configPath = getConfigPath(projectNamePath);

  if (configPath) {
    await batchHandler({
      rootDir: projectNamePath,
      extraEnvData: {
        $projectName: projectName,
      },
    });
    rmSync(configPath, { force: true });

    console.log(chalk.blue("模板项目配置注入成功, 模版项目配置文件已删除"));
  }

  console.log(chalk.blue("项目初始化完成"));

  if (parentGitDir) {
    /** 当前项目git目录 */
    const currentGitDir = path.resolve(projectNamePath);
    /** 当前项目git信息目录 */
    const currentGitInfoDir = path.resolve(currentGitDir, ".git");

    if (!existsSync(currentGitInfoDir)) {
      throw new Error("git目录不存在");
    }

    rmSync(currentGitInfoDir, { recursive: true, force: true });
    console.log(
      chalk.green(
        `项目创建在父级git仓库${parentGitDir}中，已删除${projectName}目录下的.git(${currentGitInfoDir})`,
      ),
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

      console.log(
        chalk.green(
          `已经将origin重命名为upstream，后续可以与模板git仓库有完整的交互`,
        ),
      );

      console.log(chalk.green(`已保存git历史记录`));
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

  console.log(chalk.green(`项目${projectName}初始化完成`));

  console.log(
    chalk.blue(`
使用步骤: 
  1. cd ${projectName}
  2. pnpm install
  3. pnpm run dev
  `),
  );
};
