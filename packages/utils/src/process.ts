import {
  execSync,
  type ExecSyncOptions,
  type StdioOptions,
} from "node:child_process";
import { allowConsoleLog } from "@/env-config";
import { getProcessLogStream, formatLogSteamWrite } from "@/log";
import { OutputTypeEnum } from "@/_init";

/**
 * 将 stdio 配置归一化为标准的 [stdin, stdout, stderr] 数组
 */
const normalizeStdio = (stdio?: StdioOptions): any[] => {
  if (!stdio) return ["pipe", "pipe", "pipe"];

  if (typeof stdio === "string") {
    switch (stdio) {
      case "ignore":
        return ["ignore", "ignore", "ignore"];
      case "inherit":
        return ["inherit", "inherit", "inherit"];
      case "overlapped":
        return ["overlapped", "overlapped", "overlapped"];
      default:
        return ["pipe", "pipe", "pipe"];
    }
  }

  if (Array.isArray(stdio)) {
    const res = [...stdio];
    for (let i = 0; i < 3; i++) {
      if (res[i] === undefined) res[i] = "pipe";
    }
    return res;
  }

  return ["pipe", "pipe", "pipe"];
};

/**
 * 工业级同步执行分发日志 (2026 稳定版)
 */
export const execSyncWithLogDispatch = (
  command: string,
  options?: ExecSyncOptions,
) => {
  const canOutput = allowConsoleLog();

  // --- 场景 A: 显式允许 或 用户明确要求 ignore (不写日志) ---
  if (canOutput || options?.stdio === "ignore") {
    return execSync(command, options);
  }

  // --- 场景 B: 拦截模式 (MCP/自动化环境) ---
  const stream = getProcessLogStream();
  const logFd = stream.fd as number; // 依赖你之前修改的 fs.openSync 逻辑，确保 fd 立即存在

  const normalized = normalizeStdio(options?.stdio);

  /**
   * 核心分流逻辑：
   * 1. stdin (0): 强制 ignore，防止子进程在看不到提示的情况下由于等待交互而死锁主进程。
   * 2. stdout/stderr (1, 2):
   *    - 只有原计划是 'inherit' 或 'overlapped' (输出到终端) 时，才拦截到日志 FD。
   *    - 如果原计划是 'pipe' (用于逻辑取值)，则保持不变。
   */
  const finalStdio = normalized.map((item, index) => {
    if (index === 0) return "ignore";
    if (index === 1 || index === 2) {
      if (item === "inherit" || item === "overlapped") {
        return logFd;
      }
      return item;
    }
    return item;
  });

  try {
    formatLogSteamWrite({
      stream,
      type: OutputTypeEnum.SYSTEM,
      content: `[子进程任务开始执行] ${command}`,
    });

    const result = execSync(command, {
      maxBuffer: 1024 * 1024 * 100, // 增加到 100MB，防止 pipe 模式下大数据溢出
      ...options,
      stdio: finalStdio as StdioOptions,
      encoding: options?.encoding || "utf-8",
    });

    // 补偿记录：如果是 pipe 模式，逻辑拿到了值，我们也手动在日志里备份一份副本
    if (result && normalized[1] === "pipe") {
      formatLogSteamWrite({
        stream,
        type: OutputTypeEnum.SYSTEM,
        content: `[任务执行成功返回]: ${result.toString().trim()}`,
      });
    } else {
      formatLogSteamWrite({
        stream,
        type: OutputTypeEnum.SYSTEM,
        content: `[任务执行成功]`,
      });
    }

    return result;
  } catch (error: any) {
    // 捕获异常：将错误详情写入日志，包括可能的 stderr
    const errorDetail = error.stderr ? `\nSTDERR: ${error.stderr}` : "";
    formatLogSteamWrite({
      stream,
      type: OutputTypeEnum.ERROR,
      content: `[任务执行失败]: ${command}\nSTATUS: ${error.status}\nMSG: ${error.message}${errorDetail}`,
    });

    // 保持原生抛错，让调用者可以拿到状态码
    throw error;
  }
};
