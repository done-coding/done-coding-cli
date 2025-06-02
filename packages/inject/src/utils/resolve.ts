import { _get, log } from "@done-coding/cli-utils";
import type {
  InjectKeyConfig,
  InjectKeyConfigFixed,
  InjectKeyConfigReg,
} from "./types";
import { InjectTypeEnum } from "./types";

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
        log.warn(
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
      return _get(sourceJson, targetKey);
    }
    default: {
      log.warn(`未知的配置类型${type}`);
      return undefined;
    }
  }
};
