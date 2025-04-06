import chalk from "chalk";
import path from "node:path";
import fs from "node:fs";
import { getConfig } from "./config";
import { getComponentEnvData } from "./env-data";
import type { Config } from "./types";

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
    console.log(chalk.red("组件源码路径不是目录"));
    return process.exit(1);
  }
};

export const listComponent = async () => {
  console.log(chalk.blue("展示列表"));
  const config = getConfig();
  const list = getComponentList(config);

  console.table(
    list.map((item) => {
      const { name, fullName } = getComponentEnvData({
        ...config,
        name: item,
      });
      return {
        [chalk.green("名称")]: name,
        [chalk.green("带系列名称")]: fullName,
        [chalk.green("绝对路径")]: path.resolve(config.componentDir, item),
      };
    }),
  );
};
