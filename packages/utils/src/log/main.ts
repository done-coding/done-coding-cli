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
import type { OutputParams } from "@/_init";
import { getLogTime, outputSwift, OutputTypeEnum, setLogFn } from "@/_init";

/** 标记当前进程是否已写入过文件头 */
let isHeaderWritten = false;

/** 获取当前进程对应的日志流 */
export const getProcessLogStream = (logTime = getLogTime()) => {
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
        type: OutputTypeEnum.SYSTEM,
        content: `父进程日志文件: ${parentLogName}`,
        logTime,
      });
    }
    const callMode = getCallMode();
    // stream.write(`[SYSTEM] 当前调用模式: ${callMode}\n`);
    formatLogSteamWrite({
      stream,
      type: OutputTypeEnum.SYSTEM,
      content: `当前调用模式: ${callMode}`,
      logTime,
    });
    isHeaderWritten = true;
  }
  return stream;
};

/** 写入日志 */
const writeLog = ({
  logList,
  type,
  logTime,
}: {
  /** 日志内容 */
  logList: unknown[];
  /** 日志类型 */
  type: OutputTypeEnum;
  /** 日志时间 */
  logTime: string;
}) => {
  const stream = getProcessLogStream(logTime);

  // 序列化日志内容，剥离 chalk
  const content = logList
    .map((item) => {
      if (item instanceof Error) return item.stack || item.message;
      if (typeof item === "object" && item !== null)
        return JSON.stringify(item, null, 2);
      return String(item);
    })
    .join(" ");

  // 写入纯文本日志
  formatLogSteamWrite({
    stream,
    type,
    content: content,
    logTime,
  });
};

/** 日志行为分发 */
const logActionDispatch = (...[logTime, type, ...logList]: OutputParams) => {
  // 系统日志不输出到控制台
  if (type === OutputTypeEnum.SYSTEM) {
    return writeLog({
      logList,
      type,
      logTime,
    });
  }
  if (allowConsoleLog()) {
    if (type === OutputTypeEnum.TABLE) {
      // eslint-disable-next-line no-restricted-syntax
      return console.table(...logList);
    }
    // eslint-disable-next-line no-restricted-syntax
    return console.log(chalk[type](...logList));
  } else {
    return writeLog({
      logList,
      type,
      logTime,
    });
  }
};

/** 日志 */
export const log = setLogFn(outputSwift(logActionDispatch));

/** 获取输出文字 */
export const getLogText = outputSwift<string>(
  (_logTime, type, ...messages: unknown[]) => {
    if (type === OutputTypeEnum.TABLE) {
      return JSON.stringify(messages);
    } else {
      return chalk[type](...messages);
    }
  },
);
