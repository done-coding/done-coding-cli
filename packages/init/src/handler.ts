import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import fs from "node:fs";
import path from "node:path";
import { CLI_NAMESPACE_DIR, lookForParentTargetDir } from "@/utils";
import chalk from "chalk";

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log(argv);

  const targetParentDir = lookForParentTargetDir(CLI_NAMESPACE_DIR);

  if (targetParentDir) {
    console.log(
      chalk.red(`${targetParentDir}已存在${CLI_NAMESPACE_DIR}，不能重复初始化`),
    );
    return process.exit(1);
  }

  console.log(chalk.blue(`${CLI_NAMESPACE_DIR}不存在将创建`));

  const namespaceRootDir = path.resolve(CLI_NAMESPACE_DIR);

  fs.mkdirSync(namespaceRootDir, { recursive: true });

  fs.writeFileSync(path.resolve(namespaceRootDir, ".gitkeep"), "");

  console.log(chalk.green(`初始化成功`));
};
