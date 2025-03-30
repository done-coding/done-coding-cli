import chalk from "chalk";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { CONFIG_GIT_REPO, READ_CONFIG_TEMPORARY_DIRECTORY } from "./const";
import { getPkgName } from "./packageInfo";
import type { TemplateChoiceItem } from "./question";

/** 配置文件 */
export interface ConfigJson {
  templateList: TemplateChoiceItem[];
}

/** 读取配置 */
export const readConfig = (): ConfigJson => {
  console.log(chalk.blue(`拉取模板列表，请稍等...`));

  const configDir = path.resolve(
    process.cwd(),
    READ_CONFIG_TEMPORARY_DIRECTORY,
  );

  execSync(`git clone ${CONFIG_GIT_REPO} ${configDir} --depth=1`);

  const pkgName = getPkgName();

  const configPath = path.resolve(configDir, `${pkgName}.json`);

  const config: ConfigJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!Array.isArray(config.templateList)) {
    throw new Error("远程配置文件出错，templateList 不是数组");
  }

  console.log(chalk.green(`模板列表拉取成功！`));

  fs.rmSync(configDir, { recursive: true, force: true });

  return config;
};
