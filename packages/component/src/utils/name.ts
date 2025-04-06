import chalk from "chalk";
import type { Config } from "./types";
/**
 * 组件名检测
 * ---
 * 限制只能字母、数字、中划线且以字母开头
 */
export const ensureNameLegal = (name: string, config: Config) => {
  if (!/^[a-zA-Z]+[a-zA-Z0-9-]*$/.test(name)) {
    console.log(chalk.red("组件名只能包含字母、数字、中划线"));
    return process.exit(1);
  }
  const { nameExcludes } = config;
  if (nameExcludes.includes(name)) {
    console.log(
      chalk.red(`组件名: ${name}是保留名称。
保留名称: ${nameExcludes.join(",")}`),
    );
    return process.exit(1);
  }

  return true;
};
