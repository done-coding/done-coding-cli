import {
  getRemoveDirForm,
  projectNameForm,
  saveGitHistoryForm,
  getTemplateChoices,
  getTemplateForm,
  type Options,
} from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import prompts from "prompts";
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import path, { resolve } from "node:path";
import chalk from "chalk";
import { CUSTOM_TEMPLATE_NAME } from "@/utils";
import { getConfigPath, batchHandler } from "@done-coding/cli-template";
import { lookForParentTarget } from "@done-coding/node-tools";

// eslint-disable-next-line complexity
export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
  const { projectName: projectNameInit, template: templateInit } = argv;
  const projectNameNoTrim =
    projectNameInit ?? (await prompts(projectNameForm)).projectName;

  const projectName = (projectNameNoTrim || "").trim();

  if (!projectName.trim()) {
    console.log(chalk.red("项目名称不能为空"));
    return;
  }
  if (
    projectName.includes(" ") ||
    projectName.includes("\\") ||
    projectName.includes("/")
  ) {
    console.log(chalk.red("项目名称不能包含空格或者\\或者/"));
    return;
  }

  const projectNamePath = resolve(process.cwd(), projectName);

  if (existsSync(projectNamePath)) {
    const { isRemove } = await prompts(getRemoveDirForm());
    if (isRemove === true) {
      rmSync(projectNamePath, { recursive: true, force: true });
    } else {
      console.log(chalk.red("项目已存在"));
      return process.exit(1);
    }
  }

  const template =
    templateInit ?? (await prompts(await getTemplateForm())).template;

  let remoteUrl = "";

  if (template === CUSTOM_TEMPLATE_NAME) {
    const { customUrl } = await prompts({
      type: "text",
      name: "customUrl",
      message: "请输入自定义模板路径",
    });
    remoteUrl = customUrl;
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
  }

  /** 父级git目录 */
  const parentGitDir = lookForParentTarget(".git");

  console.log(chalk.green("正在初始化项目，请稍等..."));

  execSync(`git clone ${remoteUrl} ${projectName} --depth=1`);

  const configPath = getConfigPath(projectNamePath);

  if (configPath) {
    await batchHandler({
      rootDir: projectNamePath,
      extraEnvData: {
        $projectName: projectName,
      },
    });
    const { isRemoveTemplateConfig } = await prompts({
      type: "confirm",
      name: "isRemoveTemplateConfig",
      message: `已成功将模板项目配置注入到当前项目，是否删除模板项目配置文件(${configPath})`,
      initial: true,
    });
    if (isRemoveTemplateConfig) {
      rmSync(configPath, { force: true });
    }
  }

  console.log(chalk.green("项目初始化完成"));

  if (parentGitDir) {
    /** 当前项目git目录 */
    const currentGitDir = path.resolve(projectNamePath);
    /** 当前项目git信息目录 */
    const currentGitInfoDir = path.resolve(currentGitDir, ".git");

    if (!existsSync(currentGitInfoDir)) {
      throw new Error("git目录不存在");
    }

    const { isRemoveGit } = await prompts({
      type: "confirm",
      name: "isRemoveGit",
      message: `项目创建在父级git仓库${parentGitDir}中，是否删除${projectName}目录下的.git(${currentGitInfoDir})`,
      initial: true,
    });
    if (isRemoveGit) {
      rmSync(currentGitInfoDir, { recursive: true, force: true });
      console.log(chalk.green("已删除当前项目git目录"));
    } else {
      console.log(
        chalk.yellow(
          `项目创建在父级git仓库${parentGitDir}中，请手动删除${projectName}目录下的.git(${currentGitInfoDir})，否则会影响后续的git操作`,
        ),
      );
    }
  } else {
    // 如果项目不在git仓库中，则询问是否保存git历史记录

    const saveGitHistory = (await prompts(saveGitHistoryForm)).saveGitHistory;

    if (saveGitHistory) {
      // 保存git记录则重命名origin为upstream 同时完整克隆仓库
      execSync(
        `cd ${projectNamePath} && git remote rename origin upstream && git fetch --unshallow`,
      );

      console.log(
        chalk.green(
          `已经将origin重命名为upstream，后续可以与模板git仓库有完整的交互`,
        ),
      );

      console.log(
        chalk.green(`已保存git历史记录，后续可以与模板git仓库有完整的交互`),
      );
    } else {
      // 项目git目录
      const projectNameGitPath = path.resolve(projectNamePath, ".git");
      rmSync(projectNameGitPath, { recursive: true, force: true });

      execSync(`cd ${projectNamePath} && git init`);
    }

    // 提交代码
    execSync(
      `cd ${projectNamePath} && git add . && git commit -m '初始化${projectName}'`,
    );
  }

  console.log(
    chalk.blue(`
使用步骤: 
  1. cd ${projectName}
  2. pnpm install
  3. pnpm run dev
  `),
  );
};
