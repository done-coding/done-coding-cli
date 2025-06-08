import type { CliInfo } from "@done-coding/cli-utils";
import {
  getConfigFileCommonOptions,
  readConfigFile,
  type CliHandlerArgv,
  type SubCliInfo,
} from "@done-coding/cli-utils";
import type { EnginConfig } from "@/types";
import { EnginConfigKeyEnum, SubcommandEnum, type InitOptions } from "@/types";
import { fileURLToPath } from "node:url";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MODULE_DEFAULT_CONFIG_RELATIVE_PATH } from "@/utils";

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
  console.log(16, argv);

  const {
    [EnginConfigKeyEnum.DEV_DEPENDENCIES]: devDependencies,
    [EnginConfigKeyEnum.LINT_STAGED]: lintStaged,
  } = (await readConfigFile(argv)) as EnginConfig;

  const { rootDir } = argv;

  const packagePath = path.resolve(rootDir, "package.json");

  const projectPackagesStr = readFileSync(packagePath, "utf-8");

  console.log(16, projectPackagesStr);

  const projectPackages = JSON.parse(projectPackagesStr) as EnginConfig;

  projectPackages[EnginConfigKeyEnum.DEV_DEPENDENCIES] = {
    ...projectPackages[EnginConfigKeyEnum.DEV_DEPENDENCIES],
    ...devDependencies,
  };

  projectPackages[EnginConfigKeyEnum.LINT_STAGED] = {
    ...projectPackages[EnginConfigKeyEnum.LINT_STAGED],
    ...lintStaged,
  };

  writeFileSync(packagePath, JSON.stringify(projectPackages, null, 2));

  cpSync(path.join(__dirname, "../files"), rootDir, {
    recursive: true,
    force: true,
  });
};

export const addCommandCliInfo: SubCliInfo = {
  command: SubcommandEnum.ADD,
  describe: "添加工程化配置",
  options: addOptions(),
  handler: addHandler as SubCliInfo["handler"],
};
