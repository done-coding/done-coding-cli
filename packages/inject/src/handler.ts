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

  // 源文件路径
  const sourceJsonFileFullPath = path.resolve(
    process.cwd(),
    sourceJsonFilePath,
  );

  const sourceJson = JSON.parse(
    fs.readFileSync(sourceJsonFileFullPath, "utf-8"),
  );

  const injectInfo: Record<string, any> = injectKeyPath.reduce((acc, key) => {
    _set(acc, key, _get(sourceJson, key));
    return acc;
  }, {});

  /** 保存的注入文件路径 */
  const injectInfoFileFullPath = path.resolve(
    process.cwd(),
    injectInfoFilePath,
  );
  fs.writeFileSync(injectInfoFileFullPath, JSON.stringify(injectInfo, null, 2));
  console.log(
    chalk.green(`文件注入成功过: ${injectInfoFileFullPath}`),
    chalk.blue(JSON.stringify(injectInfo)),
  );
  return injectInfo;
};
