import chalk from "chalk";

/** 日志类型 */
enum LogTypeEnum {
  /** 成功 */
  SUCCESS = "green",
  /** 主要的/步骤 */
  PRIMARY = "blue",
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
    /** 主要的/步骤 */
    primary: (...messages: string[]) => log(LogTypeEnum.PRIMARY, ...messages),
    /** 警告 */
    warn: (...messages: string[]) => log(LogTypeEnum.WARN, ...messages),
    /** 错误 */
    error: (...messages: string[]) => log(LogTypeEnum.ERROR, ...messages),
  },
);
