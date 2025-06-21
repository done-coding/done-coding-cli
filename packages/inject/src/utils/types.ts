import type {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 初始化提取配置文件 */
  INIT = "init",
  /** 生成文件 */
  GENERATE = "generate",
}

/** 配置类型枚举 */
export enum InjectTypeEnum {
  /**
   * 正则表达式 类型
   */
  REG = "reg",
  /**
   * 固定值 类型
   */
  FIXED = "fixed",
  /**
   * 读取 类型
   */
  READ = "read",
}

/** 初始化选项 */
export type InitOptions = InitConfigFileOptions;

/** 注入配置基础 */
export interface InjectKeyConfigBase<T extends InjectTypeEnum> {
  /**
   * 提取类型
   */
  type: T;
}

/** 注入配置-正则类型 */
export interface InjectKeyConfigReg
  extends InjectKeyConfigBase<InjectTypeEnum.REG> {
  /**
   * 正则表达式字符串
   * ----
   * 不带flags
   */
  pattern: string;
  /** 正则匹配的 flags */
  flags?: string;
  /**
   * 替换值
   * ---
   * replace 第二个参数
   */
  replaceValue: string;
  /** 源key */
  sourceKey: string;
}

/** 注入配置-固定值类型  */
export interface InjectKeyConfigFixed
  extends InjectKeyConfigBase<InjectTypeEnum.FIXED> {
  /** 值 */
  value: string;
}

/** 注入配置-读取类型 */
export interface InjectKeyConfigRead
  extends InjectKeyConfigBase<InjectTypeEnum.READ> {
  /** 源key */
  sourceKey?: string;
}

/**
 * 注入配置
 * ---
 * 为 string 时 解析为 InjectKeyConfigFixed, 其中InjectKeyConfigFixed.value = string
 */
export type InjectKeyConfig =
  | InjectKeyConfigReg
  | InjectKeyConfigFixed
  | InjectKeyConfigRead;

/** @deprecated */
export interface Options {
  /** json文件相对路径 */
  sourceJsonFilePath: string;
  /** 注入的key路径 */
  injectKeyPath: string[];
  /** 注入信息文件路径 */
  injectInfoFilePath: string;
}

/** 注入配置 */
export interface InjectConfig {
  /** json文件相对路径 */
  sourceFilePath: string;
  /** 注入的key路径 */
  keyConfigMap: Record<string, InjectKeyConfig>;
  /** 注入信息文件路径 */
  injectFilePath: string;
}

/** 生成选项 */
export type GenerateOptions = ReadConfigFileOptions;
