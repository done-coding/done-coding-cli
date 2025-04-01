import type { Options } from "@/utils";
import type { ArgumentsCamelCase } from "yargs";
import fs from "node:fs";
import path from "node:path";
import { CLI_NAMESPACE_DIR } from "@/utils";
import chalk from "chalk";

export const handler = async (argv: ArgumentsCamelCase<Options>) => {
  console.log(argv);

  const namespaceRootDir = path.resolve(CLI_NAMESPACE_DIR);
  if (fs.existsSync(namespaceRootDir)) {
    console.log(chalk.red(`不能重复初始化`));
  } else {
    console.log(chalk.blue(`${CLI_NAMESPACE_DIR}不存在将创建`));
    fs.mkdirSync(namespaceRootDir, { recursive: true });

    fs.writeFileSync(path.resolve(namespaceRootDir, ".gitkeep"), "");

    console.log(chalk.green(`初始化成功`));
  }
};
