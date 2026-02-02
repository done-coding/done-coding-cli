/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2025-04-06 13:23:00
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-01 17:46:15
 */
import { outputConsole } from "@done-coding/cli-utils";
import type { Config } from "@/types";
/**
 * 组件名检测
 * ---
 * 限制只能字母、数字、中划线且以字母开头
 */
export const ensureNameLegal = (name: string, config: Config) => {
  if (!/^[a-zA-Z]+[a-zA-Z0-9-]*$/.test(name)) {
    outputConsole.error("组件名只能包含字母、数字、中划线");
    return process.exit(1);
  }
  const { nameExcludes } = config;
  if (nameExcludes.includes(name)) {
    outputConsole.error(`组件名: ${name}是保留名称。
保留名称: ${nameExcludes.join(",")}`);
    return process.exit(1);
  }

  return true;
};
