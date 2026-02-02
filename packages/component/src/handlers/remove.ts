/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-06-28 16:04:26
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:46:08
 */
import type { RemoveOptions } from "@/types";
import { SubcommandEnum } from "@/types";
import { getComponentList } from "./list";
import fs from "node:fs";
import path from "node:path";
import type { CliHandlerArgv, SubCliInfo } from "@done-coding/cli-utils";
import { outputConsole, xPrompts } from "@done-coding/cli-utils";
import { getComponentEnvData, getConfig, operateComponent } from "@/utils";

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
}: CliHandlerArgv<RemoveOptions>) => {
  outputConsole.stage("移除组件");
  const config = getConfig();
  const list = await getComponentList(config);
  if (list.length === 0) {
    outputConsole.error("组件列表为空");
    return process.exit(1);
  }
  let name: string;
  if (!nameInit) {
    name = (
      await xPrompts({
        type: "select",
        name: "name",
        message: "请选择要移除的组件",
        choices: list.map((item) => {
          return { title: item, value: item };
        }),
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

  outputConsole.error(`组件${name}不存在`);
  return process.exit(1);
};

/** 删除组件cli信息 */
export const commandCliInfo: SubCliInfo = {
  command: `${SubcommandEnum.REMOVE} [name]`,
  describe: "删除一个组件",
  positionals: getPositionals(),
  handler: handler as SubCliInfo["handler"],
};
