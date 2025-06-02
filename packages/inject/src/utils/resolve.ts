import { _get, log } from "@done-coding/cli-utils";
import type {
  InjectKeyConfig,
  InjectKeyConfigFixed,
  InjectKeyConfigReg,
} from "./types";
import { ConfigTypeEnum } from "./types";

/** 配置解析-获取最终值 */
export const configResolve = ({
  sourceJson,
  targetKey,
  config: configInit,
}: {
  sourceJson: Record<string, any>;
  targetKey: string;
  config: InjectKeyConfig;
}) => {
  let config: Exclude<InjectKeyConfig, string>;
  if (typeof configInit === "string") {
    config = {
      type: ConfigTypeEnum.FIXED,
      value: configInit,
    };
  } else {
    config = configInit;
  }

  const { type = ConfigTypeEnum.READ } = config;

  switch (type) {
    case ConfigTypeEnum.REG: {
      const { sourceKey, pattern, replaceValue, flags } =
        config as InjectKeyConfigReg;
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
    case ConfigTypeEnum.FIXED: {
      const { value } = config as InjectKeyConfigFixed;
      return value;
    }
    case ConfigTypeEnum.READ: {
      return _get(sourceJson, targetKey);
    }
    default: {
      log.warn(`未知的配置类型${type}`);
      return undefined;
    }
  }
};
