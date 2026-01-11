import { assetIsExits, removeAsset } from "./file-operate";
import { log } from "./log";

/**
 * 申请使用临时目录
 * ---
 * !!! 临时目录 默认 执行完成及退出信号发出时 清理临时文件
 */
export const applyUseTempDir = <T>({
  dir,
  fn,
  endClear = true,
  exitClear = true,
}: {
  dir: string;
  fn: (dir: string) => T;
  /** 结束时移除临时目录 */
  endClear?: boolean;
  /** 退出信号是否移除临时目录 */
  exitClear?: boolean;
}): T => {
  /** 文件存在直接提示 并退出 */
  if (assetIsExits(dir)) {
    log.error(`${dir} 已存在，请手动删除该目录再试`);
    return process.exit(1);
  }

  // 清除临时文件夹
  const clear = () => {
    log.stage("正在清理临时目录...", dir);
    removeAsset(dir);
  };

  // 退出信号 清除
  if (exitClear) {
    process.once("exit", () => {
      log.stage("发现进程退出，正在清理临时目录...", dir);
      clear();
    });
  }

  let res: any;
  try {
    res = fn(dir);
  } catch (error) {
    // 同步错误立即清理并抛出
    if (endClear) {
      clear();
    }
    throw error;
  }

  // 结束时 清除
  if (endClear) {
    if (res instanceof Promise) {
      res.finally(clear);
    } else {
      clear();
    }
  }
  return res;
};
