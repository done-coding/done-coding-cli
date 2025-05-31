import chalk from "chalk";

/** 日志类型 */
enum LogTypeEnum {
  /** 成功 */
  SUCCESS = "green",
  /** 步骤 */
  STAGE = "blue",
  /** 提示信息 */
  INFO = "cyan",
  /** 警告 */
  WARN = "yellow",
  /** 错误 */
  ERROR = "red",
}

/** 日志 */
export const log = Object.assign(
  (type: LogTypeEnum, ...messages: string[]) => {
    return console.log(...messages.map((item) => chalk[type](item)));
  },
  {
    /** 成功 */
    success: (...messages: string[]) => log(LogTypeEnum.SUCCESS, ...messages),
    /** /步骤 */
    stage: (...messages: string[]) => log(LogTypeEnum.STAGE, ...messages),
    /** 提示信息 */
    info: (...messages: string[]) => log(LogTypeEnum.INFO, ...messages),
    /** 警告 */
    warn: (...messages: string[]) => log(LogTypeEnum.WARN, ...messages),
    /** 错误 */
    error: (...messages: string[]) => log(LogTypeEnum.ERROR, ...messages),
  },
);
