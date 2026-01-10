import {
  SubcommandEnum,
  type AddConfigOptions,
  type ConfigConfigJson,
  type ConfigModuleEnum,
  type ConfigProjectConfigItem,
} from "@/types";
import type { ArgumentsCamelCase } from "yargs";
import {
  getOptions as getCheckOptions,
  handler as checkHandler,
} from "./check";
import type { SubCliInfo } from "@done-coding/cli-utils";
import {
  addHuskyHooks,
  addPackageConfig,
  log,
  readCliModuleAssetsConfig,
  xPrompts,
} from "@done-coding/cli-utils";
import { adjustModuleList, configModulePkgNameMap } from "@/utils";
import { execSync } from "node:child_process";
import fs, { existsSync } from "node:fs";
import path from "node:path";
import type yargs from "yargs";
import injectInfo from "@/injectInfo.json";

const {
  cliConfig: { moduleName },
} = injectInfo;

export const getOptions = (): {
  [key: string]: yargs.Options;
} => {
  return {
    ...getCheckOptions(),
    commitGit: {
      type: "boolean",
      alias: "g",
      description: "添加完成后是否提交到git",
      default: false,
    },
  };
};

/** 选择模块配置 */
const selectModuleConfig = async ({
  moduleName,
  moduleConfigList,
}: {
  moduleName: ConfigModuleEnum;
  moduleConfigList: ConfigProjectConfigItem[];
}) => {
  if (!Array.isArray(moduleConfigList) || moduleConfigList.length === 0) {
    log.error(`未找到 ${moduleName} 预设版本配置`);
    return;
  }
  if (moduleConfigList.length === 1) {
    const res = moduleConfigList[0];
    log.skip(
      `${moduleName} 跳过版本选择: 仅有一个预设版本配置, 默认选择第一个(${res.version})`,
    );
    return res;
  }
  const { version } = await xPrompts({
    type: "select",
    name: "version",
    message: `请选择需要添加的${moduleName}版本`,
    choices: moduleConfigList.map((item) => {
      const { version } = item;
      const pkgName = configModulePkgNameMap[moduleName];
      return {
        title: `${pkgName}@${version}`,
        value: version,
      };
    }),
  });
  return moduleConfigList.find((item) => item.version === version);
};

/** 选择配置文件信息 */
const selectConfigFileInfo = async ({
  moduleName,
  moduleConfig,
}: {
  moduleName: ConfigModuleEnum;
  moduleConfig: ConfigProjectConfigItem;
}) => {
  const { configFileInfoList } = moduleConfig;
  if (!Array.isArray(configFileInfoList) || configFileInfoList.length === 0) {
    log.error(`未找到 ${moduleName} 配置文件信息列表`);
    return;
  }
  if (configFileInfoList.length === 1) {
    const res = configFileInfoList[0];

    log.skip(
      `${moduleName} 跳过配置文件信息选择: 仅有一个配置文件信息, 默认选择第一个(${res.sourceFile})`,
    );

    return res;
  }
  const { info } = await xPrompts({
    type: "select",
    name: "info",
    message: "请选择需要添加的配置文件",
    choices: configFileInfoList.map((item) => {
      const { sourceFile, description } = item;
      return {
        title: sourceFile,
        value: item,
        description,
      };
    }),
  });

  return configFileInfoList.find((item) => item.sourceFile === info.sourceFile);
};

/** 添加依赖包 */
const addPkg = ({ rootDir, list }: { rootDir: string; list: string[] }) => {
  log.stage(`开始安装依赖包: ${JSON.stringify(list, null, 2)}`);
  const pnpmWorkspaceFilePath = path.resolve(rootDir, "pnpm-workspace.yaml");
  const isPnpmWorkspace = existsSync(pnpmWorkspaceFilePath);
  execSync(`pnpm add -D ${isPnpmWorkspace ? "-w" : ""} ${list.join(" ")}`, {
    cwd: rootDir,
    stdio: "inherit",
  });
};

/** 添加husky配置 */
const addHuskyConfig = async ({
  hooksConfig,
  argv,
}: {
  hooksConfig: Record<string, string>;
  argv: ArgumentsCamelCase<AddConfigOptions>;
}) => {
  return Object.entries(hooksConfig).forEach(async ([hookName, cmd]) => {
    await addHuskyHooks({
      hookNames: [hookName],
      rootDir: argv.rootDir,
      getCode: () => cmd,
    });
  });
};

/** 添加模块配置 */
const resolveModuleConfig = async ({
  moduleName,
  moduleConfigList,
  argv,
}: {
  moduleName: ConfigModuleEnum;
  moduleConfigList: ConfigProjectConfigItem[];
  argv: ArgumentsCamelCase<AddConfigOptions>;
}) => {
  const moduleConfig = await selectModuleConfig({
    moduleName,
    moduleConfigList,
  });
  if (!moduleConfig) {
    return;
  }
  const configFileInfo = await selectConfigFileInfo({
    moduleName,
    moduleConfig,
  });
  if (!configFileInfo) {
    return;
  }
  const {
    relyPackages: moduleConfigRelyPackages = [],
    version,
    runScripts = [],
  } = moduleConfig;
  const {
    relyPackages: configFileInfoRelyPackages = [],
    sourceFile,
    targetFile,
  } = configFileInfo;
  const modulePkgName = configModulePkgNameMap[moduleName];
  const pkgList = [
    `${modulePkgName}@${version}`,
    ...moduleConfigRelyPackages,
    ...configFileInfoRelyPackages,
  ];

  log.stage(`需要安装的依赖包: 
${JSON.stringify(pkgList, null, 2)}`);

  await addPackageConfig({
    patchConfig: moduleConfig.packageJson,
    rootDir: argv.rootDir,
  });

  return {
    sourceFile,
    targetFile,
    version,
    pkgList,
    runScripts,
    /** 方法内部已经使用husky了 但是所有依赖包在最后才统一安装 */
    addHuskyConfigFn: () =>
      addHuskyConfig({
        hooksConfig: moduleConfig.husky?.hooks || {},
        argv,
      }),
  };
};

/** 解析模块配置列表 */
export const resolveModuleConfigList = ({
  listConfig,
  moduleDir,
  moduleName,
}: {
  listConfig: ConfigProjectConfigItem[] | string;
  moduleDir: string;
  moduleName: ConfigModuleEnum;
}) => {
  if (typeof listConfig === "string") {
    console.log(listConfig);
    const presetListJsonFile = path.resolve(moduleDir, listConfig);
    if (!existsSync(presetListJsonFile)) {
      throw new Error(
        `${moduleName} 预设列表文件 ${presetListJsonFile} 不存在`,
      );
    }
    const presetListJsonStr = fs.readFileSync(presetListJsonFile, "utf-8");
    const presetList = JSON.parse(
      presetListJsonStr,
    ) as ConfigProjectConfigItem[];
    return presetList;
  } else {
    if (!Array.isArray(listConfig)) {
      throw new Error(
        `(${moduleName})预置项必须是数组或者是相对于当前工程化配置模块目录的相对路径`,
      );
    }
    return listConfig;
  }
};

export const handler = async (argv: ArgumentsCamelCase<AddConfigOptions>) => {
  const { config, info } = await checkHandler(argv);

  const { moduleList: moduleListInit = [] } = config;

  const moduleList = adjustModuleList(moduleListInit);

  const needAddModuleList = moduleList.filter((item) => {
    const itemInfo = info[item];
    if (itemInfo) {
      log.skip(`
检测到 ${item} 已配置, ${JSON.stringify(itemInfo, null, 2)},
跳过添加 ${item}`);
      return false;
    }
    return true;
  });

  if (!needAddModuleList.length) {
    log.success(`所有配置项均已配置, 无需添加`);
    return;
  }

  await readCliModuleAssetsConfig<ConfigConfigJson>({
    moduleName,
    onSuccess: async ({
      config: cliConfig,
      // configTemporaryDir,
      // cliConfigDirRelativePath,
      assetsConfigRepoTempDir,
      moduleEntryFileRelativePath,
    }) => {
      if (!cliConfig?.project) {
        throw new Error("项目工程化预设不存在");
      }
      log.success(`预设配置拉取成功`);

      const { project } = cliConfig;

      const { rootDir } = argv;

      /** 等待安装的依赖包 */
      const waitInstallPkgList: string[] = [];

      /** 等待添加husky配置的函数 */
      const waitAddHuskyConfigFns: (() => Promise<void>)[] = [];

      /** 等待运行的脚本 */
      const waitRunScripts: string[] = [];

      for (let moduleName of needAddModuleList) {
        // 模块对应目录
        const moduleDir = path.resolve(
          assetsConfigRepoTempDir,
          moduleEntryFileRelativePath,
        );

        const moduleConfigList = resolveModuleConfigList({
          listConfig: project[moduleName],
          moduleDir,
          moduleName,
        });
        if (!moduleConfigList) {
          log.error(`未找到 ${moduleName} 预设配置`);
          return;
        }
        log.stage(`开始添加 ${moduleName} 配置`);

        // console.log(moduleConfigList);
        const res = await resolveModuleConfig({
          moduleName,
          moduleConfigList,
          argv,
        });
        if (res) {
          const {
            sourceFile,
            targetFile,
            version,
            pkgList,
            addHuskyConfigFn,
            runScripts,
          } = res;
          const sourceFilePath = path.resolve(moduleDir, version, sourceFile);
          const targetFilePath = path.resolve(rootDir, targetFile);

          log.stage(`开始复制 ${sourceFilePath} -> ${targetFilePath}`);

          const targetFileDir = path.dirname(targetFilePath);
          if (!fs.existsSync(targetFileDir)) {
            fs.mkdirSync(targetFileDir, { recursive: true });
          }
          fs.copyFileSync(sourceFilePath, targetFilePath);

          log.success(`添加 ${moduleName} 配置成功, 路径: ${targetFilePath}`);

          waitInstallPkgList.push(...pkgList);
          waitAddHuskyConfigFns.push(addHuskyConfigFn);
          waitRunScripts.push(...runScripts);
        }
      }

      await addPkg({
        rootDir,
        list: [...new Set(waitInstallPkgList)],
      });

      for (let cmd of waitRunScripts) {
        log.stage(`运行脚本: ${cmd}`);
        execSync(cmd, { cwd: rootDir, stdio: "inherit" });
      }

      await Promise.all(waitAddHuskyConfigFns.map((fn) => fn()));
    },
  });

  const { commitGit, rootDir } = argv;

  if (commitGit) {
    const { commitMsg } = await xPrompts({
      type: "text",
      name: "commitMsg",
      message: "请输入提交信息",
      initial: `chore: 添加 ${needAddModuleList.join(", ")} 工程化配置`,
    });
    execSync(`git add .`, { cwd: rootDir, stdio: "inherit" });
    execSync(`git commit -m "${commitMsg}"`, {
      cwd: rootDir,
      stdio: "inherit",
    });
  }
};

export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.ADD,
  describe: "添加工程化配置",
  options: getOptions(),
  handler: handler as SubCliInfo["handler"],
};
