/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import {
  readConfigFile,
  getConfigFileCommonOptions,
  type CliHandlerArgv,
  type CliInfo,
  log,
  _set,
} from "@done-coding/cli-utils";
import type { InjectConfig, GenerateOptions } from "./types";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "./path";
import path from "node:path";
import fs from "node:fs";
import { keyConfigResolve } from "./resolve";
import configDefault from "../json/default";

/** 获取生成命令选项 */
export const getGenerateOptions = (): CliInfo["options"] => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
  };
};

/** 生成注入信息文件 */
export const generateFile = async ({
  rootDir = process.cwd(),
  config = configDefault,
  keyConfigMap: extractKeyConfigMap = {},
}: {
  rootDir?: string;
  config?: InjectConfig;
  keyConfigMap?: InjectConfig["keyConfigMap"];
} = {}) => {
  const {
    sourceFilePath,
    keyConfigMap: defaultKeyConfigMap,
    injectFilePath,
  } = config;

  const keyConfigMap: InjectConfig["keyConfigMap"] = {
    ...defaultKeyConfigMap,
    ...extractKeyConfigMap,
  };

  if (!sourceFilePath.endsWith(".json")) {
    log.error("源文件必须是json");
    return process.exit(1);
  }

  if (!injectFilePath.endsWith(".json")) {
    log.error("注入文件必须是json");
    return process.exit(1);
  }

  // 源文件路径
  const sourceFileFullPath = path.resolve(rootDir, sourceFilePath);

  const sourceStr = fs.readFileSync(sourceFileFullPath, "utf-8");

  const sourceJson = JSON.parse(sourceStr);

  const injectInfo = Object.entries(keyConfigMap).reduce(
    (acc, [targetKey, keyConfig]) => {
      const value = keyConfigResolve({ sourceJson, targetKey, keyConfig });
      _set(acc, targetKey, value);
      return acc;
    },
    {},
  );

  /** 保存的注入文件路径 */
  const injectInfoFileFullPath = path.resolve(rootDir, injectFilePath);

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
  log.success(`文件注入成功: ${injectInfoFileFullPath}`);
  log.info(injectInfoJson);
};

/** 提取文件命令处理器 */
export const generateHandler = async (
  argv: CliHandlerArgv<GenerateOptions>,
) => {
  const config = await readConfigFile<InjectConfig>(argv);
  if (!config) {
    log.error(`配置文件为空`);
    return process.exit(1);
  }

  const { rootDir } = argv;

  await generateFile({ rootDir, config });
};
