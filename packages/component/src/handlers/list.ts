import path from "node:path";
import fs from "node:fs";
import type { SubCliInfo } from "@done-coding/cli-utils";
import { chalk, log } from "@done-coding/cli-utils";
import { SubcommandEnum, type Config } from "@/types";
import { getComponentEnvData, getConfig } from "@/utils";

/**
 * 获取组件列表
 */
export const getComponentList = (config: Config): string[] => {
  const { componentDir: componentDirAbsolutePath, nameExcludes } = config;
  const stats = fs.statSync(componentDirAbsolutePath);

  if (stats.isDirectory()) {
    const files = fs.readdirSync(componentDirAbsolutePath);

    const list = files
      .map((file) => {
        const filePath = path.join(componentDirAbsolutePath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          console.log("filePath:", filePath, path.basename(filePath));
          return path.basename(filePath);
        } else {
          return "";
        }
      })
      .filter((nameKebab) => {
        if (!nameKebab) {
          return false;
        }

        // 过滤排除的文件名
        if (nameExcludes.includes(nameKebab)) {
          return false;
        }
        return true;
      });

    return list;
  } else {
    log.error("组件源码路径不是目录");
    return process.exit(1);
  }
};

export const handler = async () => {
  log.stage("展示列表");
  const config = getConfig();
  const list = getComponentList(config);

  console.table(
    list.map((nameKebab) => {
      const { name, fullName } = getComponentEnvData({
        ...config,
        name: nameKebab,
      });
      return {
        [chalk.green("名称")]: name,
        [chalk.green("带系列名称")]: fullName,
        [chalk.green("绝对路径")]: path.resolve(config.componentDir, nameKebab),
      };
    }),
  );
};

/** 展示组件列表cli信息 */
export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.LIST,
  describe: "展示组件列表",
  handler: handler as SubCliInfo["handler"],
};
