/**
 * 面向使用者的预期错误（缺配置、参数冲突等）：命令失败时只打印 message，不打印调用栈。
 * 非预期故障仍用普通 Error，保留调用栈便于排查；两者都会写入日志文件。
 */
export class CliUserError extends Error {
  /** 识别标记：各包可能各带一份 utils 副本，故按字段识别而非 instanceof */
  public readonly isCliUserError = true;

  public constructor(message: string) {
    super(message);
    this.name = "CliUserError";
  }
}

/** 是否为面向使用者的预期错误 */
export const isCliUserError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { isCliUserError?: unknown }).isCliUserError === true;

/** 命令失败时写往 stderr 的内容：预期错误只给 message，其余附调用栈 */
export const formatCliFailOutput = (msg: string, err?: Error): string => {
  const message = msg || err?.message || "未知错误";
  if (err?.stack && !isCliUserError(err)) {
    return `${message}\n${err.stack}\n`;
  }
  return `${message}\n`;
};
