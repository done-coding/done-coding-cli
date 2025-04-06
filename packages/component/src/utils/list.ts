import chalk from "chalk";
import path from "node:path";
import fs from "node:fs";

/**
 * 获取组件列表
 */
export const getComponentList = (
  componentDirAbsolutePath: string,
): string[] => {
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
      .filter(Boolean);

    return list;
  } else {
    console.log(chalk.red("组件源码路径不是目录"));
    return process.exit(1);
  }
};
