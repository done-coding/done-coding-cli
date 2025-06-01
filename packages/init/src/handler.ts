import type { Options } from "@/utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import fs from "node:fs";
import path from "node:path";
import { log, lookForParentTarget } from "@done-coding/cli-utils";
import injectInfo from "@/injectInfo.json";

const NAMESPACE_DIR = injectInfo.cliConfig.namespaceDir;

export const handler = async (argv: CliHandlerArgv<Options>) => {
  console.log(argv);

  const targetParentDir = lookForParentTarget(NAMESPACE_DIR);

  if (targetParentDir) {
    log.error(`${targetParentDir}已存在${NAMESPACE_DIR}，不能重复初始化`);
    return process.exit(1);
  }

  log.stage(`${NAMESPACE_DIR}不存在将创建`);

  const namespaceRootDir = path.resolve(NAMESPACE_DIR);

  fs.mkdirSync(namespaceRootDir, { recursive: true });

  fs.writeFileSync(path.resolve(namespaceRootDir, ".gitkeep"), "");

  log.success(`初始化成功`);
};
