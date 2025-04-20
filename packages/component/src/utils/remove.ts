import type { Options } from "./types";
import { SubcommandEnum } from "./types";
import { getConfig } from "./config";
import chalk from "chalk";
import prompts from "prompts";
import { operateComponent } from "./operate";
import { getComponentList } from "./list";
import { getComponentEnvData } from "./env-data";
import fs from "node:fs";
import path from "node:path";
import { onPromptFormStateForSigint } from "@done-coding/cli-template";

/** 新增组件 */
export const removeComponent = async ({ name: nameInit }: Options) => {
  console.log(chalk.blue("移除组件"));
  const config = getConfig();
  const list = await getComponentList(config);
  if (list.length === 0) {
    console.log(chalk.red("组件列表为空"));
    return process.exit(1);
  }
  let name: string;
  if (!nameInit) {
    name = (
      await prompts({
        type: "select",
        name: "name",
        message: "请选择要移除的组件",
        choices: list.map((item) => {
          return { title: item, value: item };
        }),
        onState: onPromptFormStateForSigint,
      })
    ).name;
  } else {
    name = nameInit;
  }

  const { series } = config;
  for (let nameKebab of list) {
    const data = getComponentEnvData({
      series,
      name,
    });
    if (data.nameKebab === nameKebab) {
      await operateComponent({
        name,
        config,
        command: SubcommandEnum.REMOVE,
      });
      fs.rmdirSync(path.resolve(config.componentDir, nameKebab));
      return;
    }
  }

  console.log(chalk.red(`组件${name}不存在`));
  return process.exit(1);
};
