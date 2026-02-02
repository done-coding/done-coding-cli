/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-02-02 22:20:55
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-02 22:21:09
 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import { _get, outputConsole } from "@done-coding/cli-utils";
import type {
  InjectKeyConfig,
  InjectKeyConfigFixed,
  InjectKeyConfigRead,
  InjectKeyConfigReg,
} from "../types";
import { InjectTypeEnum } from "../types";

/** key配置解析-获取最终值 */
export const keyConfigResolve = ({
  sourceJson,
  targetKey,
  keyConfig: keyConfigInit,
}: {
  sourceJson: Record<string, any>;
  targetKey: string;
  keyConfig: InjectKeyConfig;
}) => {
  let keyConfig: Exclude<InjectKeyConfig, string>;
  if (typeof keyConfigInit === "string") {
    keyConfig = {
      type: InjectTypeEnum.FIXED,
      value: keyConfigInit,
    };
  } else {
    keyConfig = keyConfigInit;
  }

  const { type = InjectTypeEnum.READ } = keyConfig;

  switch (type) {
    case InjectTypeEnum.REG: {
      const { sourceKey, pattern, replaceValue, flags } =
        keyConfig as InjectKeyConfigReg;
      const reg = new RegExp(pattern, flags ?? undefined);
      const sourceValue = _get(sourceJson, sourceKey);
      if (typeof sourceValue === "string") {
        return sourceValue.replace(reg, replaceValue);
      } else {
        outputConsole.warn(
          `${sourceValue}不是字符串类型，无法使用正则表达式进行替换，此处将直接返回原值`,
        );
        return sourceValue;
      }
    }
    case InjectTypeEnum.FIXED: {
      const { value } = keyConfig as InjectKeyConfigFixed;
      return value;
    }
    case InjectTypeEnum.READ: {
      const { sourceKey = targetKey } = keyConfig as InjectKeyConfigRead;
      return _get(sourceJson, sourceKey);
    }
    default: {
      outputConsole.warn(`未知的配置类型${type}`);
      return undefined;
    }
  }
};
