/*
 * @Description  : 输出相关初始化
 * @Author       : supengfei
 * @Date         : 2026-01-29 17:37:10
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-29 20:50:43
 */

import { getLogTime } from "./time";

/** 输出类型 */
export enum OutputTypeEnum {
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

/** 输出参数 */
export type OutputParams = [
  logTime: string,
  type: OutputTypeEnum,
  ...messages: unknown[],
];

// 字符串枚举不像数字枚举那样支持反查 此处手动反像生成下
const outputTypeMap = Object.entries(OutputTypeEnum).reduce(
  (obj, [k, v]) => {
    obj[v] = k;
    return obj;
  },
  {} as unknown as {
    [K in OutputTypeEnum]: string;
  },
);

/** 通过 OutputTypeEnum 枚举值或者key */
export const getOutputTypeByValue = (value: OutputTypeEnum) => {
  return outputTypeMap[value] ?? value;
};

/** 输出快捷调用 */
export const outputSwift = <T>(baseFn: (...args: OutputParams) => T) => {
  return Object.assign(baseFn, {
    /** 系统 */
    system: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.SYSTEM, ...messages),
    /** 成功 */
    success: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.SUCCESS, ...messages),
    /** /步骤 */
    stage: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.STAGE, ...messages),
    /** 提示信息 */
    info: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.INFO, ...messages),
    /** 警告 */
    warn: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.WARN, ...messages),
    /** 错误 */
    error: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.ERROR, ...messages),
    /** 跳过 */
    skip: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.SKIP, ...messages),
    /** 表格 */
    table: (...messages: unknown[]) =>
      baseFn(getLogTime(), OutputTypeEnum.TABLE, ...messages),
  });
};
