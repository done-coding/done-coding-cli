// !!! 不对外导出  打印日志使用 log， 获取彩色文字 使用 getLogText
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
  /** 跳过 */
  SKIP = "gray",
}

export type LogParams = [type: LogTypeEnum, ...messages: unknown[]];

/** chalk结果使用 */
const chalkUse = <T>(fn: (res: string) => T) => {
  const baseFn = (...[type, ...messages]: LogParams) => {
    return fn(chalk[type](...messages));
  };
  return Object.assign(baseFn, {
    /** 成功 */
    success: (...messages: unknown[]) =>
      baseFn(LogTypeEnum.SUCCESS, ...messages),
    /** /步骤 */
    stage: (...messages: unknown[]) => baseFn(LogTypeEnum.STAGE, ...messages),
    /** 提示信息 */
    info: (...messages: unknown[]) => baseFn(LogTypeEnum.INFO, ...messages),
    /** 警告 */
    warn: (...messages: unknown[]) => baseFn(LogTypeEnum.WARN, ...messages),
    /** 错误 */
    error: (...messages: unknown[]) => baseFn(LogTypeEnum.ERROR, ...messages),
    /** 跳过 */
    skip: (...messages: unknown[]) => baseFn(LogTypeEnum.SKIP, ...messages),
  });
};

/** 日志 */
export const log = chalkUse(console.log);

/** 获取输出文字 */
export const getLogText = chalkUse((res) => res);
