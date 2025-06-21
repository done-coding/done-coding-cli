import type {
  AddConfigOptions,
  CheckConfigOptions,
  ConfigConfig,
  TypeConfigInfo,
} from "@/types";
import { ConfigModuleEnum } from "@/types";
import {
  getPackageJson,
  getRelyPkgVersion,
  log,
  readConfigFile,
} from "@done-coding/cli-utils";
import { existsSync } from "node:fs";
import path from "node:path";

/** 允许的模块 */
export const ALLOW_MODULE_LIST = Object.values(ConfigModuleEnum).filter(
  (item) => item.toUpperCase() !== item,
);

export const getConfig = async (
  argv: CheckConfigOptions | AddConfigOptions,
) => {
  return await readConfigFile(argv, (): ConfigConfig => {
    const { moduleList = [] } = argv;
    log.info(
      `配置文件不存在 读取命令行参数 moduleList: ${JSON.stringify(
        moduleList,
        null,
        2,
      )}`,
    );
    return {
      moduleList,
    };
  });
};

/** 配置模块与包名的映射 */
export const configModulePkgNameMap: {
  [key in ConfigModuleEnum]: string;
} = {
  [ConfigModuleEnum.ESLINT]: "eslint",
  [ConfigModuleEnum.PRETTIER]: "prettier",
  [ConfigModuleEnum.COMMITLINT]: "@commitlint/cli",
  [ConfigModuleEnum.LSLINT]: "@ls-lint/ls-lint",
  [ConfigModuleEnum.MERGELINT]: "@done-coding/cli-git",
};

const REPLACE_MARK = "_$_";

/** 配置类型与配置文件后缀的映射 */
export const configModuleConfigFileSuffixMap: {
  [key in ConfigModuleEnum]: string[];
} = {
  [ConfigModuleEnum.ESLINT]: [
    `${REPLACE_MARK}.config.js`,
    `${REPLACE_MARK}.config.mjs`,
    `${REPLACE_MARK}.config.cjs`,
    `.${REPLACE_MARK}rc`,
    `.${REPLACE_MARK}rc.js`,
    `.${REPLACE_MARK}rc.json`,
    `.${REPLACE_MARK}rc.mjs`,
    `.${REPLACE_MARK}rc.cjs`,
    `.${REPLACE_MARK}rc.yaml`,
    `.${REPLACE_MARK}rc.yml`,
  ],
  [ConfigModuleEnum.PRETTIER]: [
    `${REPLACE_MARK}.config.js`,
    `${REPLACE_MARK}.config.mjs`,
    `${REPLACE_MARK}.config.cjs`,
    `.${REPLACE_MARK}rc`,
    `.${REPLACE_MARK}rc.js`,
    `.${REPLACE_MARK}rc.json`,
    `.${REPLACE_MARK}rc.json5`,
    `.${REPLACE_MARK}rc.mjs`,
    `.${REPLACE_MARK}rc.cjs`,
    `.${REPLACE_MARK}rc.yaml`,
    `.${REPLACE_MARK}rc.yml`,
    `.${REPLACE_MARK}rc.toml`,
  ],
  [ConfigModuleEnum.COMMITLINT]: [
    `${REPLACE_MARK}.config.js`,
    `${REPLACE_MARK}.config.mjs`,
    `${REPLACE_MARK}.config.cjs`,
    `.${REPLACE_MARK}rc`,
    `.${REPLACE_MARK}rc.js`,
    `.${REPLACE_MARK}rc.json`,
    `.${REPLACE_MARK}rc.mjs`,
    `.${REPLACE_MARK}rc.cjs`,
    `.${REPLACE_MARK}rc.yaml`,
    `.${REPLACE_MARK}rc.yml`,
  ],
  [ConfigModuleEnum.LSLINT]: [`.${REPLACE_MARK}.yaml`, `.${REPLACE_MARK}.yml`],
  [ConfigModuleEnum.MERGELINT]: [`.done-coding/git.json`],
};

/** 找到指定目录下的文件 */
const findFile = (dir: string, fileList: string[]): string[] => {
  return fileList.filter((file) => existsSync(path.resolve(dir, file)));
};

/** 矫正配置模块列表 */
export const adjustModuleList = (list: string[]): ConfigModuleEnum[] => {
  return list.filter((item) => {
    const valid = ALLOW_MODULE_LIST.includes(item as ConfigModuleEnum);
    if (!valid) {
      log.warn(
        `当前不支持${item}的配置检测, 支持的类型有${ALLOW_MODULE_LIST.join(
          ", ",
        )}`,
      );
    }
    return valid;
  }) as ConfigModuleEnum[];
};

/** 获取配置信息 */
export const getConfigInfo = ({
  config,
  rootDir,
}: {
  config: ConfigConfig;
  rootDir: string;
}): TypeConfigInfo => {
  const { moduleList: moduleListInit = [] } = config;

  const moduleList = adjustModuleList(moduleListInit);

  log.stage(`开始获取${moduleList.join(", ")}配置信息...`);

  const pkgJson = getPackageJson({ rootDir });

  return moduleList.reduce(
    (acc, cur) => {
      const version = getRelyPkgVersion({
        rootDir,
        pkgJson,
        pkgName: configModulePkgNameMap[cur],
        isDevPkg: true,
      });

      if (!version) {
        return acc;
      }
      const configFileRelativePathListInit = configModuleConfigFileSuffixMap[
        cur
      ].map((item) => item.replace(REPLACE_MARK, cur));

      if (!configFileRelativePathListInit.length) {
        log.warn(`安装了${cur}, 但未找到${cur}的配置文件 认为未使用`);
        return acc;
      }

      acc[cur] = {
        version,
        configFileRelativePathList: findFile(
          rootDir,
          configFileRelativePathListInit,
        ),
      };

      return acc;
    },
    {} as unknown as TypeConfigInfo,
  );
};
