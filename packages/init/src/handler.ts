import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import fs from "node:fs";
import path from "node:path";
import { lookForParentTarget } from "@done-coding/cli-utils";
import chalk from "chalk";
import injectInfo from "@/injectInfo.json";

const NAMESPACE_DIR = injectInfo.cliConfig.namespaceDir;

export const handler = async (argv: ArgumentsCamelCase<Options> | Options) => {
  console.log(argv);

  const targetParentDir = lookForParentTarget(NAMESPACE_DIR);

  if (targetParentDir) {
    console.log(
      chalk.red(`${targetParentDir}已存在${NAMESPACE_DIR}，不能重复初始化`),
    );
    return process.exit(1);
  }

  console.log(chalk.blue(`${NAMESPACE_DIR}不存在将创建`));

  const namespaceRootDir = path.resolve(NAMESPACE_DIR);

  fs.mkdirSync(namespaceRootDir, { recursive: true });

  fs.writeFileSync(path.resolve(namespaceRootDir, ".gitkeep"), "");

  console.log(chalk.green(`初始化成功`));
};
