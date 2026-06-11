import { outputConsole } from "@/env-config";
import { safeCwd } from "@/safe-cwd";

/** handler 执行模式 */
export type HandlerMode = "cli" | "mcp" | "test";

/** handler 执行上下文 */
export interface HandlerContext {
  /** 执行来源 */
  mode: HandlerMode;
  /** 是否允许终端交互 */
  interactive: boolean;
  /** 当前命令工作目录 */
  cwd: string;
  /** 日志实例 */
  logger: typeof outputConsole;
  /** 是否允许危险操作 */
  allowDangerous: boolean;
}

/** handler 执行上下文初始化参数 */
export type HandlerContextInit = Partial<HandlerContext>;

/** 标识 done-coding 当前执行模式的环境变量 key */
export const DONE_CODING_EXEC_MODE_ENV_KEY = "DONE_CODING_EXEC_MODE";

/** 标识 done-coding 当前是否为非交互模式的环境变量 key */
export const DONE_CODING_NON_INTERACTIVE_ENV_KEY =
  "DONE_CODING_NON_INTERACTIVE";

const isHandlerMode = (value: unknown): value is HandlerMode => {
  return value === "cli" || value === "mcp" || value === "test";
};

const getModeFromEnv = (): HandlerMode | undefined => {
  const mode = process.env[DONE_CODING_EXEC_MODE_ENV_KEY];
  return isHandlerMode(mode) ? mode : undefined;
};

const getInteractiveFromEnv = (): boolean | undefined => {
  const nonInteractive = process.env[DONE_CODING_NON_INTERACTIVE_ENV_KEY];
  if (nonInteractive === undefined) {
    return;
  }
  return nonInteractive !== "1" && nonInteractive !== "true";
};

/** 解析 handler 执行上下文，显式参数优先，env 次之，最后回落到 CLI 默认值。 */
export const resolveHandlerContext = (
  ctx: HandlerContextInit = {},
): HandlerContext => {
  const mode = ctx.mode ?? getModeFromEnv() ?? "cli";

  return {
    mode,
    interactive: ctx.interactive ?? getInteractiveFromEnv() ?? mode === "cli",
    cwd: ctx.cwd ?? safeCwd(),
    logger: ctx.logger ?? outputConsole,
    allowDangerous: ctx.allowDangerous ?? false,
  };
};

/** 给仍需跨进程调用的旧路径传播上下文。 */
export const createHandlerContextEnv = (
  ctxInit: HandlerContextInit = {},
): NodeJS.ProcessEnv => {
  const ctx = resolveHandlerContext(ctxInit);
  return {
    [DONE_CODING_EXEC_MODE_ENV_KEY]: ctx.mode,
    [DONE_CODING_NON_INTERACTIVE_ENV_KEY]: ctx.interactive ? "0" : "1",
  };
};

/** 确保当前 handler 允许交互输入 */
export const assertInteractive = (
  ctxInit: HandlerContextInit | undefined,
  message: string,
) => {
  const ctx = resolveHandlerContext(ctxInit);
  if (!ctx.interactive) {
    throw new Error(message);
  }
};
