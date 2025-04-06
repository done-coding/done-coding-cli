import type { Options } from "./types";
import { SubcommandEnum } from "./types";
import { ensureNameLegal } from "./name";
import { getConfig } from "./config";
import chalk from "chalk";
import prompts from "prompts";
import { operateComponent } from "./operate";

/** 新增组件 */
export const addComponent = async ({ name: nameInit }: Options) => {
  console.log(chalk.green("添加组件"));
  let name: string;
  if (!nameInit) {
    name = (
      await prompts({
        type: "text",
        name: "name",
        message: "请输入组件名",
      })
    ).name;
  } else {
    name = nameInit;
  }
  const config = getConfig();
  ensureNameLegal(name, config);
  return operateComponent({
    name,
    config,
    command: SubcommandEnum.ADD,
  });
};
