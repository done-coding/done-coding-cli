/*
 * @Description  : 日志队列
 * @Author       : supengfei
 * @Date         : 2026-01-29 18:03:36
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-29 21:32:06
 */
import type { OutputParams, OutputTypeEnum } from "./output";
import { outputSwift } from "./output";

/** 日志队列项 */
export interface LogQueueItem {
  /** 日志内容 */
  logList: unknown[];
  /** 日志类型 */
  type: OutputTypeEnum;
  /** 日志时间 */
  logTime: string;
}

/** 日志函数类型 */
export type LogFn = ReturnType<typeof outputSwift>;

/** 日志队列作用域 */
const logQueueScoped: {
  /** 日志队列 */
  logQueue: LogQueueItem[];
  /** 日志函数 */
  logFn?: LogFn;
} = {
  logQueue: [],
  logFn: undefined,
};

/** 日志队列分发 */
const logQueueDispatch = (...[logTime, type, ...logList]: OutputParams) => {
  if (logQueueScoped.logFn) {
    logQueueScoped.logFn(logTime, type, ...logList);
    return;
  }
  logQueueScoped.logQueue.push({
    logTime,
    type,
    logList,
  });
};

/**
 *  异步日志
 * ----
 * 适用场景: config-env 也需要输出日志 但是日志模块依赖于config-env 直接使用会导致循环依赖
 * 此时可以先添加到日志队列 然后在config-env中异步调用日志队列分发
 */
export const asyncLog = outputSwift(logQueueDispatch);

/** 设置日志函数 */
export const setLogFn = (fn: LogFn) => {
  if (logQueueScoped.logFn === fn) {
    return fn;
  }
  logQueueScoped.logFn = fn;
  logQueueScoped.logQueue.splice(0).forEach((item) => {
    fn(item.logTime, item.type, ...item.logList);
  });
  return fn;
};
