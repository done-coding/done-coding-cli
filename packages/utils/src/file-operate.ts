import chalk from "chalk";
import fs from "node:fs";

// 定义执行权限的掩码
const EXEC_PERMISSIONS = 0o111;

/** 文件添加执行权限 */
export const fileAddX = (filePath: string) => {
  // 获取文件当前权限
  const currentStats = fs.statSync(filePath);
  const currentMode = currentStats.mode;

  // 判断是否已经有执行权限
  if ((currentMode & EXEC_PERMISSIONS) === EXEC_PERMISSIONS) {
    return;
  }
  console.log(chalk.blue(`${filePath} 没有执行权限 添加... `));

  // 添加执行权限
  const newMode = currentMode | EXEC_PERMISSIONS;

  // 修改文件权限
  fs.chmodSync(filePath, newMode);

  console.log(chalk.green(`${filePath} 添加执行权限成功`));
};
