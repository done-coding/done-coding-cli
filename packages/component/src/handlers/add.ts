import type { AddOptions } from "@/types";
import { SubcommandEnum } from "@/types";
import { getComponentList } from "./list";
import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { log, xPrompts } from "@done-coding/cli-utils";
import {
  ensureNameLegal,
  getComponentEnvData,
  getConfig,
  operateComponent,
} from "@/utils";

const getPositionals = (): SubCliInfo["positionals"] => {
  return {
    name: {
      describe: "组件名称",
      type: "string",
    },
  };
};

/** 新增组件 */
export const handler = async ({
  name: nameInit,
}: CliHandlerArgv<AddOptions>) => {
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

/** 新增组件cli信息 */
export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.ADD} <name>`,
  describe: "新增一个组件",
  positionals: getPositionals(),
  handler: handler as SubCliInfo["handler"],
};
