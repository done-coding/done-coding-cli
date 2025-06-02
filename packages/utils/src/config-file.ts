import type { CliHandlerArgv, CliInfo } from "./cli";
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getEditorType, openFileInEditor } from "./editor";
import { xPrompts } from "./prompts";
import { json5 } from "./json5";
import { log } from "./log";

/** 配置文件通用选项 */
export interface ConfigFileCommonOptions {
  /**
   * 相对于路径
   * ---
   * 绝对路径 path.resolve(rootDir, configPath)
   */
  configPath: string;
  /** 项目根目录 */
  rootDir: string;
}

/** 初始化文件选项 */
export type InitConfigFileOptions = ConfigFileCommonOptions;

/** 读取配置文件选项 */
export type ReadConfigFileOptions = ConfigFileCommonOptions;

/** 获取配置文件通用选项 */
export const getConfigFileCommonOptions = ({
  configPathDefault,
}: {
  configPathDefault: string;
}): CliInfo["options"] => {
  return {
    rootDir: {
      type: "string",
      alias: "r",
      describe: "运行目录",
      default: process.cwd(),
    },
    configPath: {
      type: "string",
      alias: "c",
      describe: "配置文件相对路径",
      default: configPathDefault,
    },
  };
};

/** 初始化配置文件 */
export const initConfigFile = async <T>(
  content: T,
  argv: CliHandlerArgv<InitConfigFileOptions>,
) => {
  const { configPath, rootDir } = argv;
  const configPathFinal = path.resolve(rootDir, configPath);

  const configPathDir = path.dirname(configPathFinal);
  if (!existsSync(configPathDir)) {
    mkdirSync(configPathDir, {
      recursive: true,
    });
  }
  if (configPathFinal.endsWith(".json5")) {
    log.info(`json5模式写入 ${configPathFinal}`);
    writeFileSync(configPathFinal, json5.stringify(content, null, 2));
    return configPathFinal;
  } else {
    log.info(`json模式写入 ${configPathFinal}`);
    writeFileSync(configPathFinal, JSON.stringify(content, null, 2));

    return configPathFinal;
  }
};

/** 初始化配置文件通用处理器 */
export const initHandlerCommon = async <T>(
  content: T,
  argv: CliHandlerArgv<InitConfigFileOptions>,
  {
    onFileGenerated,
  }: {
    /** 文件已生成 */
    onFileGenerated?: (path: string) => void;
  } = {},
) => {
  const configPathFinal = await initConfigFile(content, argv);
  onFileGenerated?.(configPathFinal);
  const editorType = await getEditorType();
  openFileInEditor(argv.configPath, editorType);
};

/** 读取配置文件 */
export const readConfigFile = async <T>(
  argv: CliHandlerArgv<ReadConfigFileOptions>,
): Promise<T | undefined> => {
  const { configPath, rootDir } = argv;
  const configPathFinal = path.resolve(rootDir, configPath);
  if (!existsSync(configPathFinal)) {
    return undefined;
  }
  if (configPathFinal.endsWith(".json5")) {
    log.info(`json5模式解析 ${configPathFinal}`);
    return json5.parse(readFileSync(configPathFinal, "utf8"));
  } else {
    log.info(`json模式解析 ${configPathFinal}`);
    return JSON.parse(readFileSync(configPathFinal, "utf8"));
  }
};

/** 获取是否使用默认配置 */
export const getUseDefaultConfig = async () => {
  const { useDefaultConfig } = await xPrompts({
    name: "useDefaultConfig",
    type: "confirm",
    message: "使用默认模板配置",
    initial: true,
  });

  return useDefaultConfig;
};
