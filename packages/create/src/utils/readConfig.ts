import chalk from "chalk";
import { execSync } from "node:child_process";
import path from "node:path";
import fs, { existsSync } from "node:fs";
import { CONFIG_GIT_REPO, READ_CONFIG_TEMPORARY_DIRECTORY } from "./const";
import injectInfo from "@/injectInfo.json";
import { getRemoveDirForm, type TemplateChoiceItem } from "./question";
import prompts from "prompts";

/** 配置文件 */
export interface ConfigJson {
  templateList: TemplateChoiceItem[];
}

/** 读取配置 */
export const readConfig = async (): Promise<ConfigJson> => {
  console.log(chalk.blue(`拉取模板列表，请稍等...`));

  const configDir = path.resolve(
    process.cwd(),
    READ_CONFIG_TEMPORARY_DIRECTORY,
  );

  if (existsSync(configDir)) {
    console.log(chalk.red(`${configDir} 已存在，请手动删除该目录再试`));
    return process.exit(1);
  }

  console.log(chalk.blue(`配置临时目录：${configDir}`));

  if (fs.existsSync(configDir)) {
    const removeMessage = `${configDir}目录已存在，是否删除？`;
    const { isRemove } = await prompts(getRemoveDirForm(removeMessage));
    if (isRemove) {
      fs.rmSync(configDir, { recursive: true, force: true });
    } else {
      console.log(chalk.red(`${configDir}已存在，请手动删除后再试！`));
      return process.exit(1);
    }
  }

  let config: ConfigJson;
  try {
    execSync(`git clone ${CONFIG_GIT_REPO} ${configDir} --depth=1`);

    const pkgName = injectInfo.name;

    const configPath = path.resolve(configDir, `${pkgName}.json`);

    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    if (!Array.isArray(config.templateList)) {
      const errorMsg = `远程配置文件出错, templateList 不是数组, 请检查 ${CONFIG_GIT_REPO} ${pkgName}.json`;
      throw new Error(errorMsg);
    }

    console.log(chalk.green(`模板列表拉取成功！`));
  } finally {
    fs.rmSync(configDir, { recursive: true, force: true });
  }

  return config;
};
