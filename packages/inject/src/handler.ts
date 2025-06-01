// 本文件会在vite.config.ts中vite启动前调用 此处不能用@开头的别名
import { getKey, paramsResolve, type Options } from "./utils";
import type { CliHandlerArgv } from "@done-coding/cli-utils";
import path from "node:path";
import fs from "node:fs";
import _get from "lodash.get";
import _set from "lodash.set";
import { log } from "@done-coding/cli-utils";

export const handler = async (argv: CliHandlerArgv<Options>) => {
  // console.log(argv)

  const { sourceJsonFilePath, injectKeyPath, injectInfoFilePath } = argv;

  const currentPath = process.cwd();

  if (!sourceJsonFilePath.endsWith(".json")) {
    log.error("源文件必须是json");
    return process.exit(1);
  }

  if (!injectInfoFilePath.endsWith(".json")) {
    log.error("注入文件必须是json");
    return process.exit(1);
  }

  // 源文件路径
  const sourceJsonFileFullPath = path.resolve(currentPath, sourceJsonFilePath);

  const sourceStr = fs.readFileSync(sourceJsonFileFullPath, "utf-8");

  const sourceJson = JSON.parse(sourceStr);

  const injectInfo: Record<string, any> = injectKeyPath.reduce(
    (acc, keyInit) => {
      const { key, targetKey, paramsList } = getKey(keyInit);
      if (!key) {
        log.error(`注入key不能为空,请检查配置${keyInit}是否正确`);
        return acc;
      }
      const valueInit = _get(sourceJson, key);
      const value = paramsResolve({
        valueInit,
        paramsList,
      });
      _set(acc, targetKey, value);
      return acc;
    },
    {},
  );

  /** 保存的注入文件路径 */
  const injectInfoFileFullPath = path.resolve(currentPath, injectInfoFilePath);

  const injectInfoJson = JSON.stringify(injectInfo, null, 2);

  // 检查注入文件是否存在，如果存在且内容相同，则不重复注入
  if (fs.existsSync(injectInfoFileFullPath)) {
    const currentInjectInfo = fs.readFileSync(injectInfoFileFullPath, "utf-8");

    // 如果注入文件存在且内容相同，则不重复注入
    if (injectInfoJson === currentInjectInfo) {
      log.skip(`注入文件已存在且内容相同，无需重复注入`);
      return injectInfo;
    } else {
      log.stage(`文件内容变化,开始覆盖注入文件`);
    }
  } else {
    log.stage(`开始注入文件`);
  }

  fs.writeFileSync(injectInfoFileFullPath, injectInfoJson);
  console.log(
    log.success(`文件注入成功: ${injectInfoFileFullPath}`),
    log.info(injectInfoJson),
  );
};
