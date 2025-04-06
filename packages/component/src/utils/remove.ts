import { SubcommandEnum } from "./types";
import { getConfig } from "./config";
import chalk from "chalk";
import prompts from "prompts";
import { operateComponent } from "./operate";
import path from "node:path";
import _template from "lodash.template";
import { getComponentList } from "./list";
import { getPathEnvData } from "./env-data";

/** 新增组件 */
export const removeComponent = async () => {
  console.log(chalk.green("移除组件"));
  const config = getConfig();
  const { name } = await prompts({
    type: "select",
    name: "name",
    message: "请选择要移除的组件",
    choices: (
      await getComponentList(
        path.resolve(_template(config.componentDir)(getPathEnvData())),
      )
    ).map((item) => {
      return { title: item, value: item };
    }),
  });

  return operateComponent({
    name,
    config,
    command: SubcommandEnum.REMOVE,
  });
};
