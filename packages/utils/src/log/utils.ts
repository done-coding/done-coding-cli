/** 日志类型 */
export enum LogTypeEnum {
  /** 系统 */
  SYSTEM = "magenta",
  /** 成功 */
  SUCCESS = "greenBright",
  /** 步骤 */
  STAGE = "blue",
  /** 提示信息 */
  INFO = "white",
  /** 警告 */
  WARN = "yellow",
  /** 错误 */
  ERROR = "redBright",
  /** 跳过 */
  SKIP = "dim",
  /** ---- 表格 ---- */
  TABLE = "table",
}

// 字符串枚举不像数字枚举那样支持反查 此处手动反像生成下
const logTypeMap = Object.entries(LogTypeEnum).reduce(
  (obj, [k, v]) => {
    obj[v] = k;
    return obj;
  },
  {} as unknown as {
    [K in LogTypeEnum]: string;
  },
);

/** 通过 LogTypeEnum 枚举值或者key */
export const getLogTypeByValue = (value: LogTypeEnum) => {
  return logTypeMap[value] ?? value;
};
