/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-02-03 19:57:36
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 11:32:06
 */
import type { ProcessCustomEvent } from "@/_event";
import { PROCESS_EVENT_NAME_MAP } from "@/_event";
import { DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON_KEY } from "@/const";
import type { EnvConfigProcessCreateByHijackPresetInfo } from "@/env-config";
import { outputConsole } from "@/env-config";
import { spawn } from "node:child_process";

/** 劫持子进程选项 */
export interface HijackChildProcessOptions extends EnvConfigProcessCreateByHijackPresetInfo {
  /** 命令 */
  command: string;
  /** 参数 */
  args: string[];
  /** 工作目录 */
  cwd: string;
  /** 环境变量 */
  env: NodeJS.ProcessEnv;
}

/**
 * 劫持子进程
 * -----
 * 用途:
 * 如 mcp模式禁止控制台输出、process.exit等操作,需要shim进程拦截控制台输出及退出
 * 如果mcp禁止输入 那么监听到开始等待用户输入事件后 那么直接中断子进程
 */
export const hijackChildProcess = ({
  command,
  args,
  env,
  cwd,
  beforeInputExit,
}: HijackChildProcessOptions) => {
  return new Promise<{
    success: boolean;
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    // 状态锁，确保 Promise 只响应一次
    let isFinished = false;

    const processCreateByHijackPresetInfo: EnvConfigProcessCreateByHijackPresetInfo =
      {
        beforeInputExit,
      };

    const childProcess = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      env: {
        ...env,
        [DONE_CODING_PROCESS_CREATE_BY_HIJACK_PRESET_JSON_KEY]: JSON.stringify(
          processCreateByHijackPresetInfo,
        ),
      },
    });

    const cleanup = () => {
      isFinished = true;
      childProcess.removeAllListeners(); // 批量清理所有监听器
    };

    const errorHandler = (error: Error) => {
      if (isFinished) return;
      cleanup();
      reject(error);
    };

    const messageHandler = (message: ProcessCustomEvent) => {
      outputConsole.debug(`劫持子进程消息:`, message, isFinished);
      if (isFinished) return;
      switch (message.type) {
        case PROCESS_EVENT_NAME_MAP.PROMPTS_START_WAIT_USER_INPUT: {
          break;
        }
        case PROCESS_EVENT_NAME_MAP.PROMPTS_END_WAIT_USER_INPUT: {
          break;
        }
      }
    };

    // 不会多次触发
    childProcess.once("error", errorHandler);
    // 可能会多次触发
    childProcess.on("message", messageHandler);

    let stdout = "";
    let stderr = "";
    childProcess.stdout?.on("data", (data) => {
      stdout += data;
    });
    childProcess.stderr?.on("data", (data) => {
      stderr += data;
    });
    // 只会触发一次
    childProcess.once("exit", (code, signal) => {
      if (isFinished) return;
      cleanup();
      const success = code === 0;
      if (!success) {
        reject(new Error(`进程退出，退出码: ${code}`));
      } else {
        // 如果是被 kill 的（例如触发了 InputStart 后的中断），signal 会有值
        resolve({
          success,
          code: code ?? null,
          signal: signal ?? null,
          stdout,
          stderr,
        });
      }
    });
  });
};
