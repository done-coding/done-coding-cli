import chalk from "chalk";
import fs from "node:fs";

// 定义执行权限的掩码
const EXEC_PERMISSIONS = 0o111;

/** 文件添加执行权限 */
export const fileAddX = (filePath: string) => {
  // 获取文件当前权限
  const currentStats = fs.statSync(filePath);
  const currentMode = currentStats.mode;

  // 判断是否已经有执行权限
  if ((currentMode & EXEC_PERMISSIONS) === EXEC_PERMISSIONS) {
    return;
  }
  console.log(chalk.blue(`${filePath} 没有执行权限 添加... `));

  // 添加执行权限
  const newMode = currentMode | EXEC_PERMISSIONS;

  // 修改文件权限
  fs.chmodSync(filePath, newMode);

  console.log(chalk.green(`${filePath} 添加执行权限成功`));
};

/** 文件或文件夹是否存在(同步) */
export const assetIsExits = (
  /** 资源路径 */
  assetPath: string,
) => {
  return fs.existsSync(assetPath);
};

/**
 * 检查路径是否存在（包括文件、目录、符号链接）
 * 异步版本，行为与 fs.existsSync 一致
 */
export const assetIsExitsAsync = async (path: string): Promise<boolean> => {
  try {
    // 使用 lstat 不跟随符号链接
    await fs.promises.lstat(path);
    return true;
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;

    // 根据 Node.js 源码，existsSync 只对 ENOENT 返回 false
    // 其他情况（权限不足、无效路径等）都返回 true
    if (err.code === "ENOENT") {
      return false;
    }

    // 以下情况返回 true（与 existsSync 一致）：
    // - EACCES (权限不足)
    // - ENOTDIR (路径存在但不是目录)
    // - EPERM (操作不允许)
    // - EINVAL (无效参数，但路径可能以某种形式存在)
    // - 其他非 ENOENT 错误
    return true;
  }
};

/**
 * 删除资源 (同步)
 * ---
 * 无论文件还是文件夹
 */
export const removeAsset = (
  /** 资源路径 */
  assetPath: string,
  /** 是否要强删除 */
  force = false,
) => {
  if (assetIsExits(assetPath)) {
    fs.rmSync(assetPath, { recursive: true, force });
  }
};

/**
 * 删除资源 (异步)
 * ---
 * 无论文件还是文件夹
 */
export const removeAssetAsync = async (
  /** 资源路径 */
  assetPath: string,
  /** 是否要强删除 */
  force = false,
) => {
  if (await assetIsExitsAsync(assetPath)) {
    await fs.promises.rm(assetPath, { recursive: true, force });
  }
};

/** 读取文件[同步] */
export const readFile = (assetPath: string) => {
  return fs.readFileSync(assetPath, "utf-8");
};

/** 读取文件[异步] */
export const readFileAsync = (assetPath: string) => {
  return fs.promises.readFile(assetPath, "utf-8");
};

/** 读取json文件[同步] */
export const readJsonFile = <T>(assetPath: string, defaultValue?: T) => {
  return (JSON.parse(readFile(assetPath)) || defaultValue) as T;
};

/** 读取json文件[异步] */
export const readJsonFileAsync = async <T>(
  assetPath: string,
  defaultValue?: T,
): Promise<T> => {
  return (JSON.parse(await readFileAsync(assetPath)) || defaultValue) as T;
};
