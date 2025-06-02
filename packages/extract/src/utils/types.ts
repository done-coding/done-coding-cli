import type {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";
import type { CompileTemplateConfig } from "@done-coding/cli-template";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 初始化提取配置文件 */
  INIT = "init",
  /** 生成文件 */
  GENERATE = "generate",
}

/** 提取方式枚举 */
export enum ExtractTypeEnum {
  /**
   * 正则表达式
   * ---
   * 通过正则匹配后 replace 替换
   */
  REG = "reg",
  /**
   * 直接读取
   * ---
   * 只限于读取json文件
   */
  READ = "read",
}

/** 初始化选项 */
export type InitOptions = InitConfigFileOptions;

/** 提取配置基础 */
export interface ExtractInputKeyConfigBase<T extends ExtractTypeEnum> {
  /**
   * 提取类型
   */
  type: T;
}

/** 提取配置正则表达式 */
export interface ExtractInputKeyConfigReg
  extends ExtractInputKeyConfigBase<ExtractTypeEnum.REG> {
  /**
   * 源key
   * ---
   * 不指定则与targetKey相同
   */
  sourceKey?: string;
  /**
   * 正则表达式字符串
   * ----
   * 不带flags
   */
  pattern: string;
  /** 正则匹配的 flags */
  flags?: string;
  /** 替换值 */
  replaceValue: string;
}

/** 提取配置直接读取 */
export interface ExtractInputKeyConfigRead
  extends ExtractInputKeyConfigBase<ExtractTypeEnum.READ> {
  /**
   * 源key
   * ---
   * 不指定则与targetKey相同
   */
  sourceKey?: string;
}

/** 提取配置 */
export type ExtractInputKeyConfig =
  | ExtractInputKeyConfigReg
  | ExtractInputKeyConfigRead;

/** 提取输入配置 */
export interface ExtractInputConfig {
  [key: string]: ExtractInputKeyConfig;
}

export interface ExtractConfig {
  /**
   * 输入配置
   * -- 每个源文件 对应一个配置
   */
  extractInput: Record<string, ExtractInputConfig>;
  /** 输出配置 */
  extractOutput: CompileTemplateConfig;
}

/** 生成选项 */
export type GenerateOptions = ReadConfigFileOptions;
