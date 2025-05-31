import type { Options } from "./types";
import { SubcommandEnum } from "./types";
import { ensureNameLegal } from "./name";
import { getConfig } from "./config";
import { operateComponent } from "./operate";
import { getComponentList } from "./list";
import { getComponentEnvData } from "./env-data";
import { log, xPrompts } from "@done-coding/cli-utils";

/** 新增组件 */
export const addComponent = async ({ name: nameInit }: Options) => {
  log.stage("添加组件");
  let name: string;
  if (!nameInit) {
    name = (
      await xPrompts({
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
  const { series } = config;
  const list = await getComponentList(config);
  for (let nameKebab of list) {
    const data = getComponentEnvData({
      series,
      name,
    });
    if (data.nameKebab === nameKebab) {
      log.error(`组件${nameKebab}已存在, 不能再次创建${name}组件`);
      return process.exit(1);
    }
  }
  return operateComponent({
    name,
    config,
    command: SubcommandEnum.ADD,
  });
};
