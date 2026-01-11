import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { tmpdir, homedir } from "node:os";
import { assetIsExitsAsync, readJsonFileAsync } from "./file-operate";
import {
  ASSETS_CONFIG_REPO_URL_DEFAULT,
  DONE_CODING_CLI_TEMP_ASSETS_CONFIG_RELATIVE_DIR,
  DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH,
  DONE_CODING_CLI_ASSETS_CONFIG_REPO_DIR_NAME,
  DONE_CODING_CLI_ASSETS_CONFIG_REPO_MODULE_ENTRY,
} from "./const";
import { isHttpGitUrl, isSshGitUrl } from "./git";
import { applyUseTempDir } from "./temp-dir";
import { uuidv4 } from "./uuid";
import { log } from "./log";

/** done-coding-cli 全局配置 key 枚举 */
export enum DoneCodingCliGlobalConfigKeyEnum {
  /**
   * 资产配置仓库
   * ---
   * 1. http ssh则认为远程仓库 临时拉取到本地临时目录中
   * 2. 若非上述 则认为本地【绝对】路径
   */
  ASSETS_CONFIG_REPO_URL = "ASSETS_CONFIG_REPO_URL",
}

/** done-coding-cli 全局配置 */
export type DoneCodingCliGlobalConfig = {
  [K in DoneCodingCliGlobalConfigKeyEnum]: string;
};

/** 获取cli模块【临时】目录[绝对路径] */
export const getCliModuleTempDir = (moduleName: string) => {
  return path.resolve(
    tmpdir(),
    DONE_CODING_CLI_TEMP_ASSETS_CONFIG_RELATIVE_DIR,
    `${moduleName}-${uuidv4()}`,
  );
};

/** 【全局】获取全局配置文件目录 */
const getGlobalConfigJsonFilePath = () => {
  return path.resolve(homedir(), DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH);
};

/** 获取全局配置文件 */
const getGlobalConfig = async (): Promise<DoneCodingCliGlobalConfig> => {
  const filePath = getGlobalConfigJsonFilePath();

  const config: DoneCodingCliGlobalConfig = {
    [DoneCodingCliGlobalConfigKeyEnum.ASSETS_CONFIG_REPO_URL]:
      ASSETS_CONFIG_REPO_URL_DEFAULT,
  };
  try {
    if (await assetIsExitsAsync(filePath)) {
      const fileConfig = await readJsonFileAsync<
        Partial<DoneCodingCliGlobalConfig>
      >(filePath, {});
      Object.entries(fileConfig).forEach(([key, value]) => {
        config[key as DoneCodingCliGlobalConfigKeyEnum] = value;
      });
    }
  } catch (error) {}

  return config;
};

/** 创建本地资产配置临时仓库 */
const createLocalAssetsConfigTempRepo = async (configTemporaryDir: string) => {
  if (await assetIsExitsAsync(configTemporaryDir)) {
    log.error(`${configTemporaryDir} 已存在，请手动删除该目录再试`);
    return process.exit(1);
  }

  const {
    [DoneCodingCliGlobalConfigKeyEnum.ASSETS_CONFIG_REPO_URL]:
      assetConfigRepoUrl,
  } = await getGlobalConfig();
  if (isSshGitUrl(assetConfigRepoUrl) || isHttpGitUrl(assetConfigRepoUrl)) {
    execSync(`git clone ${assetConfigRepoUrl} ${configTemporaryDir} --depth=1`);
  } else {
    fs.mkdirSync(configTemporaryDir, { recursive: true });
    execSync(`cp -r ${assetConfigRepoUrl}/ ${configTemporaryDir}/`);
  }

  return {
    assetConfigRepoUrl,
  };
};

/** 读取(某个模块)配置 */
export const readCliModuleAssetsConfig = async <R>({
  moduleName,
  onSuccess,
}: {
  moduleName: string;
  onSuccess: (params: {
    /**
     * 资产配置仓库地址
     * ----
     * 可能是 http ssh 也可能是本地【绝对】文件路径
     */
    repoUrl: string;
    /** 资产配置文件临时目录[绝对路径] */
    assetsConfigRepoTempDir: string;
    /** 模块对应的资产配置仓库(相对路径) */
    moduleDirFileRelativePath: string;
    /** 模块对应的资产配置入口文件(相对路径) */
    moduleEntryFileRelativePath: string;
    /** 配置文件内容 */
    config: R;
  }) => void | Promise<void>;
}): Promise<R> => {
  log.stage(`拉取${moduleName}配置，请稍等...`);

  return applyUseTempDir({
    // 资源配置仓库临时文件夹
    dir: getCliModuleTempDir(moduleName),
    fn: async (tempDir) => {
      const { assetConfigRepoUrl } =
        await createLocalAssetsConfigTempRepo(tempDir);

      // 模块 cli 配置目录(相对路径)
      const moduleDir = path.join(
        DONE_CODING_CLI_ASSETS_CONFIG_REPO_DIR_NAME,
        moduleName,
      );

      // 模块 cli 入口配置文件(相对路径)
      const moduleEntryFilePath = path.join(
        moduleDir,
        DONE_CODING_CLI_ASSETS_CONFIG_REPO_MODULE_ENTRY,
      );

      // 模块 cli 入口配置文件(绝对路径)
      const moduleEntryFileAbsPath = path.resolve(tempDir, moduleEntryFilePath);

      const config = await readJsonFileAsync<R>(moduleEntryFileAbsPath);

      await onSuccess({
        repoUrl: assetConfigRepoUrl,
        config,
        moduleDirFileRelativePath: moduleDir,
        moduleEntryFileRelativePath: moduleEntryFilePath,
        assetsConfigRepoTempDir: tempDir,
      });

      return config;
    },
  });
};
