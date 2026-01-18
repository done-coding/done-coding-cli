// !!! 不对外导出  打印日志使用 log， 获取彩色文字 使用 getLogText
import chalk from "chalk";
import {
  allowConsoleLog,
  getLogOutputDir,
  getCurrentProcessLogFileName,
  getParentProcessLogFileName,
  getCallMode,
} from "@/env-config";
import path from "node:path";
import { getLogStream } from "./stream";
import { formatLogSteamWrite } from "./format";
import { LogTypeEnum } from "./utils";

export type LogParams = [type: LogTypeEnum, ...messages: unknown[]];

/** 标记当前进程是否已写入过文件头 */
let isHeaderWritten = false;

/** 获取当前进程对应的日志流 */
export const getProcessLogStream = () => {
  const dir = getLogOutputDir();
  const filePath = path.resolve(dir, getCurrentProcessLogFileName());
  const stream = getLogStream(filePath);

  // --- 关键逻辑：首次写入时添加父进程溯源信息 ---
  if (!isHeaderWritten) {
    const parentLogName = getParentProcessLogFileName();
    if (parentLogName) {
      // stream.write(`[SYSTEM] 父进程日志文件: ${parentLogName}\n`);
      formatLogSteamWrite({
        stream,
        type: LogTypeEnum.SYSTEM,
        content: `父进程日志文件: ${parentLogName}`,
      });
    }
    const callMode = getCallMode();
    // stream.write(`[SYSTEM] 当前调用模式: ${callMode}\n`);
    formatLogSteamWrite({
      stream,
      type: LogTypeEnum.SYSTEM,
      content: `当前调用模式: ${callMode}`,
    });
    isHeaderWritten = true;
  }
  return stream;
};

/** 写入日志 */
const writeLog = (logList: unknown[], type: LogTypeEnum) => {
  const stream = getProcessLogStream();

  // 序列化日志内容，剥离 chalk
  const content = logList
    .map((item) => {
      if (item instanceof Error) return item.stack || item.message;
      if (typeof item === "object" && item !== null)
        return JSON.stringify(item);
      return String(item);
    })
    .join(" ");

  // 写入纯文本日志
  formatLogSteamWrite({
    stream,
    type,
    content: content,
  });
};

/** 日志行为分发 */
const logActionDispatch = (...[type, ...logList]: LogParams) => {
  if (allowConsoleLog()) {
    if (type === LogTypeEnum.TABLE) {
      // eslint-disable-next-line no-restricted-syntax
      return console.table(...logList);
    }
    // eslint-disable-next-line no-restricted-syntax
    return console.log(chalk[type](...logList));
  } else {
    return writeLog(logList, type);
  }
};

/** 彩色文字快捷调用 */
const colorTextSwift = <T>(
  baseFn: (...[type, ...messages]: LogParams) => T,
) => {
  return Object.assign(baseFn, {
    /** 系统 */
    system: (...messages: unknown[]) => baseFn(LogTypeEnum.SYSTEM, ...messages),
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
    /** 表格 */
    table: (...messages: unknown[]) => baseFn(LogTypeEnum.TABLE, ...messages),
  });
};

/** 日志 */
export const log = colorTextSwift(logActionDispatch);

/** 获取输出文字 */
export const getLogText = colorTextSwift<string>(
  (type, ...messages: unknown[]) => {
    if (type === LogTypeEnum.TABLE) {
      return JSON.stringify(messages);
    } else {
      return chalk[type](...messages);
    }
  },
);
