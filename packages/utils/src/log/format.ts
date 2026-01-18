import type { WriteStream } from "node:fs";
import { getLogTime } from "@/time";
import type { LogTypeEnum } from "./utils";
import { getLogTypeByValue } from "./utils";

/** 格式化日志流写入格式 */
export const formatLogSteamWrite = ({
  stream,
  type,
  content,
}: {
  /** 流类型 */
  stream: WriteStream;
  /** 日志类型 */
  type: LogTypeEnum;
  /** 日志内容 */
  content: string;
}) => {
  return stream.write(
    `[${getLogTime()}] [${getLogTypeByValue(type)}] ${content}\n`,
  );
};
