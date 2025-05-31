import { log } from "@done-coding/cli-utils";

/** 配置类型枚举 */
export enum ConfigTypeEnum {
  /**
   * 正则表达式类型
   * -----
   * @example `${key}:${targetKey}:REG:${pattern}:${replaceValue}:${flags}`
   */
  REG = "REG",
  /**
   * 直接设置值类型
   * -----
   * @example `${key}:${targetKey}:VALUE:${value}`
   */
  VALUE = "VALUE",
  /**
   * 默认类型
   * -----
   * @example `${key}`
   * @example `${key}:${targetKey}`
   */
  DEFAULT = "DEFAULT",
}

/** 切割正则 */
const splitReg = /(?<!\/):/;

/** 获取配置key及其参数 */
export const getKey = (configStr: string) => {
  const [key, targetKey = key, ...paramsList] = configStr.split(splitReg);
  return {
    key,
    /** 目标key */
    targetKey,
    /** 参数列表 */
    paramsList,
  };
};

/** 参数解析-获取最终值 */
export const paramsResolve = ({
  valueInit,
  paramsList,
}: {
  valueInit: any;
  paramsList: string[];
}) => {
  const [type, ...otherParams] = paramsList;

  switch (type) {
    case ConfigTypeEnum.REG: {
      const [pattern, replaceValue, flags] = otherParams;
      const reg = new RegExp(pattern, flags ?? undefined);
      if (typeof valueInit === "string") {
        return valueInit.replace(reg, replaceValue);
      } else {
        log.warn(
          `${valueInit}不是字符串类型，无法使用正则表达式进行替换，此处将直接返回原值`,
        );
        return valueInit;
      }
    }
    case ConfigTypeEnum.VALUE: {
      const [value] = otherParams;
      return value;
    }
    default: {
      return valueInit;
    }
  }
};
