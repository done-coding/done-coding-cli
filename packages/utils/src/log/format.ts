/*
 * @Description  : 日志格式化
 * @Author       : supengfei
 * @Date         : 2026-01-29 17:32:37
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-29 20:49:49
 */
import type { WriteStream } from "node:fs";
import { getLogTime, getOutputTypeByValue } from "@/_init";
import type { OutputTypeEnum } from "@/_init";

/** 格式化日志流写入格式 */
export const formatLogSteamWrite = ({
  stream,
  type,
  content,
  logTime = getLogTime(),
}: {
  /** 流类型 */
  stream: WriteStream;
  /** 日志类型 */
  type: OutputTypeEnum;
  /** 日志内容 */
  content: string;
  /** 日志时间 */
  logTime?: string;
}) => {
  return stream.write(
    `[${logTime}] [${getOutputTypeByValue(type)}] ${content}\n`,
  );
};
