import {
  projectNameForm,
  saveGitHistoryForm,
  shallowCloneForm,
  templateChoices,
  templateForm,
  type Options,
} from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import prompts from "prompts";
import { execSync } from "node:child_process";
import { writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import { CUSTOM_TEMPLATE_NAME } from "@/utils";

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  const {
    projectName: projectNameInit,
    template: templateInit,
    saveGitHistory: saveGitHistoryInit,
    shallowClone: shallowCloneInit,
  } = argv;
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
    const { isRemove } = await prompts({
      type: "confirm",
      name: "isRemove",
      message: "项目已存在，是否删除",
    });
    if (isRemove === true) {
      rmSync(projectNamePath, { recursive: true, force: true });
    } else {
      console.log(chalk.red("项目已存在"));
      return process.exit(1);
    }
  }

  const template = templateInit ?? (await prompts(templateForm)).template;

  let remoteUrl = "";

  if (template === CUSTOM_TEMPLATE_NAME) {
    const { customUrl } = await prompts({
      type: "text",
      name: "customUrl",
      message: "请输入自定义模板路径",
    });
    remoteUrl = customUrl;
  } else {
    const target = templateChoices.find((item) => item.name === template);
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

  console.log(chalk.green("正在初始化项目，请稍等..."));

  execSync(`git clone ${remoteUrl} ${projectName} --depth=1`);

  const saveGitHistory =
    saveGitHistoryInit ?? (await prompts(saveGitHistoryForm)).saveGitHistory;

  if (saveGitHistory === false) {
    const gitDir = `${projectNamePath}/.git`;
    if (!existsSync(gitDir)) {
      throw new Error("git目录不存在");
    }
    rmSync(`${projectNamePath}/.git`, { recursive: true, force: true });
  } else {
    execSync(`cd ${projectNamePath} && git remote rename origin upstream`);
  }

  const pkgContent = readFileSync(`${projectNamePath}/package.json`, "utf-8");
  const pkg = JSON.parse(pkgContent);
  const { name } = pkg;
  pkg.name = projectName;
  rmSync(`${projectNamePath}/package.json`);

  writeFileSync(
    `${projectNamePath}/package.json`,
    JSON.stringify(pkg, null, 2),
  );

  const readmeContent = readFileSync(`${projectNamePath}/README.md`, "utf-8");
  const newReadmeContent = readmeContent.replace(name, projectName);
  rmSync(`${projectNamePath}/README.md`);
  writeFileSync(`${projectNamePath}/README.md`, newReadmeContent);

  console.log(chalk.green("项目初始化完成"));

  if (saveGitHistory) {
    // 保留历史记录 同时又只使用浅克隆 二次确认下是否使用浅克隆
    const shallowClone = shallowCloneInit
      ? (await prompts(shallowCloneForm)).shallowClone
      : false;
    // 不使用浅克隆
    if (!shallowClone) {
      execSync(`cd ${projectNamePath} && git fetch --unshallow`);
      console.log(
        chalk.green(`已完整克隆项目，后续可以与模板git仓库有完整的交互`),
      );
    } else {
      console.log(
        chalk.yellow(`当前使用浅克隆，后续不能与模板git仓库有完整的交互`),
      );
    }
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
