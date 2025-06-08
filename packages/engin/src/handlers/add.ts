import type { CliInfo } from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  log,
  readConfigFile,
  type CliHandlerArgv,
  type SubCliInfo,
} from "@done-coding/cli-utils";
import type { EnginConfig } from "@/types";
import {
  EnginConfigKeyEnum,
  EnginConfigScriptsEnum,
  SubcommandEnum,
  type InitOptions,
} from "@/types";
import { fileURLToPath } from "node:url";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";
import configDefault from "@/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** add命令选项 */
export const addOptions = (): CliInfo["options"] => {
  return {
    ...getConfigFileCommonOptions({
      configPathDefault: MODULE_DEFAULT_CONFIG_RELATIVE_PATH,
    }),
  };
};

/** 添加工程化配置命令处理器 */
export const addHandler = async (argv: CliHandlerArgv<InitOptions>) => {
  let config = await readConfigFile<EnginConfig>(argv);

  if (!config) {
    log.info("未找到工程化配置文件，使用默认配置");
    config = configDefault;
  }

  const {
    [EnginConfigKeyEnum.DEV_DEPENDENCIES]: devDependencies,
    [EnginConfigKeyEnum.LINT_STAGED]: lintStaged,
    [EnginConfigKeyEnum.SCRIPTS]: scripts,
  } = config;

  const { rootDir } = argv;

  const packagePath = path.resolve(rootDir, "package.json");

  const projectPackagesStr = readFileSync(packagePath, "utf-8");

  const projectPackages = JSON.parse(projectPackagesStr) as EnginConfig;

  projectPackages[EnginConfigKeyEnum.DEV_DEPENDENCIES] = {
    ...(projectPackages[EnginConfigKeyEnum.DEV_DEPENDENCIES] || {}),
    ...devDependencies,
  };

  projectPackages[EnginConfigKeyEnum.LINT_STAGED] = {
    ...(projectPackages[EnginConfigKeyEnum.LINT_STAGED] || {}),
    ...lintStaged,
  };

  const oldPrepareScript =
    projectPackages[EnginConfigKeyEnum.SCRIPTS]?.[
      EnginConfigScriptsEnum.PREPARE
    ];

  const prepareScript = `${oldPrepareScript ? `${oldPrepareScript} && ` : ""}${
    scripts[EnginConfigScriptsEnum.PREPARE]
  }`;

  projectPackages[EnginConfigKeyEnum.SCRIPTS] = {
    ...(projectPackages[EnginConfigKeyEnum.SCRIPTS] || {}),
    ...scripts,
    [EnginConfigScriptsEnum.PREPARE]: prepareScript,
  };

  writeFileSync(packagePath, JSON.stringify(projectPackages, null, 2));

  log.success("工程化包添加成功");

  cpSync(path.join(__dirname, "../files"), rootDir, {
    recursive: true,
    force: true,
  });
  log.success("工程化各包配置添加成功");
};

export const addCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.ADD,
  describe: "添加工程化配置",
  options: addOptions(),
  handler: addHandler as SubCliInfo["handler"],
};
