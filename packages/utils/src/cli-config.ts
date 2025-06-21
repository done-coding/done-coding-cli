import chalk from "chalk";
import { execSync } from "node:child_process";
import fs, { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

/** cli 配置仓库地址 */
const CONFIG_GIT_REPO =
  "git@gitee.com:justsosu/done-coding-cli-assets-config.git";

/** 获取读取配置临时(git)目录 */
const getReadConfigTemporaryDirectory = (moduleName: string) => {
  return `./.DONE_CODING_CLI/CONFIG_TEMP_DIR_FOR_${moduleName}`;
};

/** 获取模块 cli 配置目录相对路径 */
const getModuleCliConfigRelativeDir = (moduleName: string) => {
  return `./assets/${moduleName}`;
};

/** 获取模块 cli 配置文件相对路径 */
const getModuleCliConfigFileRelativePath = (moduleName: string) => {
  return `${getModuleCliConfigRelativeDir(moduleName)}/index.json`;
};

/** 读取配置 */
export const readCliConfig = async <R>({
  moduleName,
  onSuccess,
}: {
  moduleName: string;
  onSuccess: (params: {
    repoUrl: string;
    /** 配置文件相对路径 */
    cliConfigFileRelativePath: string;
    /** 配置文件目录相对路径 */
    cliConfigDirRelativePath: string;
    /** 配置文件内容 */
    config: R;
    /** 配置临时目录 */
    configTemporaryDir: string;
  }) => void | Promise<void>;
}): Promise<R> => {
  console.log(chalk.blue(`拉取${moduleName}配置，请稍等...`));

  const READ_CONFIG_TEMPORARY_DIRECTORY =
    getReadConfigTemporaryDirectory(moduleName);

  const configTemporaryDir = path.resolve(
    tmpdir(),
    READ_CONFIG_TEMPORARY_DIRECTORY,
  );

  if (existsSync(configTemporaryDir)) {
    console.log(
      chalk.red(`${configTemporaryDir} 已存在，请手动删除该目录再试`),
    );
    return process.exit(1);
  }

  const removeConfigTemporaryDir = () => {
    rmSync(configTemporaryDir, { recursive: true, force: true });
  };

  let config: R;
  try {
    execSync(`git clone ${CONFIG_GIT_REPO} ${configTemporaryDir} --depth=1`);

    const cliConfigFileRelativePath =
      getModuleCliConfigFileRelativePath(moduleName);

    const cliConfigDirRelativePath = getModuleCliConfigRelativeDir(moduleName);

    const cliConfigFileAbsPath = path.resolve(
      configTemporaryDir,
      cliConfigFileRelativePath,
    );

    config = JSON.parse(fs.readFileSync(cliConfigFileAbsPath, "utf-8"));

    process.once("exit", () => {
      if (existsSync(configTemporaryDir)) {
        console.log("发现进程退出，正在清理临时目录...");
        removeConfigTemporaryDir();
      }
    });

    await onSuccess({
      repoUrl: CONFIG_GIT_REPO,
      config,
      cliConfigFileRelativePath,
      cliConfigDirRelativePath,
      configTemporaryDir,
    });
  } finally {
    removeConfigTemporaryDir();
  }

  return config;
};
