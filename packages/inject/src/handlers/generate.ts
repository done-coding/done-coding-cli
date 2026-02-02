/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import type {
  SubCliInfo,
  CliHandlerArgv,
  CliInfo,
} from "@done-coding/cli-utils";
import {
  readConfigFile,
  getConfigFileCommonOptions,
  outputConsole,
  _set,
} from "@done-coding/cli-utils";
import path from "node:path";
import fs from "node:fs";
import {
  keyConfigResolve,
  MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
} from "../utils";
import configDefault from "../config";
import type { GenerateOptions, InjectConfig } from "../types";

/** 获取生成命令选项 */
export const getOptions = (): CliInfo["options"] => {
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
    outputConsole.error("源文件必须是json");
    return process.exit(1);
  }

  if (!injectFilePath.endsWith(".json")) {
    outputConsole.error("注入文件必须是json");
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
      outputConsole.skip(`注入文件已存在且内容相同，无需重复注入`);
      return injectInfo;
    } else {
      outputConsole.stage(`文件内容变化,开始覆盖注入文件`);
    }
  } else {
    outputConsole.stage(`开始注入文件`);
  }

  fs.writeFileSync(injectInfoFileFullPath, injectInfoJson);
  outputConsole.success(`文件注入成功: ${injectInfoFileFullPath}`);
  outputConsole.info(injectInfoJson);
};

/** 提取文件命令处理器 */
export const handler = async (argv: CliHandlerArgv<GenerateOptions>) => {
  const config = await readConfigFile<InjectConfig>(argv, () => {
    outputConsole.info(`配置文件为空，使用默认配置`);
    return configDefault;
  });
  if (!config) {
    outputConsole.error(`配置文件为空`);
    return process.exit(1);
  }

  const { rootDir } = argv;

  await generateFile({ rootDir, config });
};

export const commandCliInfo: SubCliInfo = {
  command: "$0",
  describe: "生成文件",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
