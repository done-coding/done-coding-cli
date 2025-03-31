import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import path from "node:path";
import fs from "node:fs";
import _get from "lodash.get";
import _set from "lodash.set";
import chalk from "chalk";

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  // console.log(argv)

  const { sourceJsonFilePath, injectKeyPath, injectInfoFilePath } = argv;

  const currentPath = process.cwd();

  if (!sourceJsonFilePath.endsWith(".json")) {
    console.log(chalk.red("源文件必须是json"));
    return process.exit(1);
  }

  if (!injectInfoFilePath.endsWith(".json")) {
    console.log(chalk.red("注入文件必须是json"));
    return process.exit(1);
  }

  // 源文件路径
  const sourceJsonFileFullPath = path.resolve(currentPath, sourceJsonFilePath);

  const sourceJson = JSON.parse(
    fs.readFileSync(sourceJsonFileFullPath, "utf-8"),
  );

  const injectInfo: Record<string, any> = injectKeyPath.reduce((acc, key) => {
    _set(acc, key, _get(sourceJson, key));
    return acc;
  }, {});

  /** 保存的注入文件路径 */
  const injectInfoFileFullPath = path.resolve(currentPath, injectInfoFilePath);

  const injectInfoJson = JSON.stringify(injectInfo, null, 2);

  // 检查注入文件是否存在，如果存在且内容相同，则不重复注入
  if (fs.existsSync(injectInfoFileFullPath)) {
    const currentInjectInfo = fs.readFileSync(injectInfoFileFullPath, "utf-8");

    // 如果注入文件存在且内容相同，则不重复注入
    if (injectInfoJson === currentInjectInfo) {
      console.log(chalk.green("注入文件已存在且内容相同，无需重复注入"));
      return injectInfo;
    } else {
      console.log(chalk.green("文件内容变化,开始覆盖注入文件"));
    }
  } else {
    console.log(chalk.green("开始注入文件"));
  }

  fs.writeFileSync(injectInfoFileFullPath, injectInfoJson);
  console.log(
    chalk.green(`文件注入成功: ${injectInfoFileFullPath}`),
    chalk.blue(injectInfoJson),
  );
  return injectInfo;
};
