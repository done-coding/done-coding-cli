import type {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";
import type { CompileTemplateConfig } from "@done-coding/cli-template";
import type {
  InjectKeyConfig,
  InjectKeyConfigReg,
} from "@done-coding/cli-inject";

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
   * 正则 类型
   * ---
   * 通过正则匹配后 replace 替换
   */
  REG = "reg",
  /**
   * json注入 类型
   * ---
   * 只限于读取json文件 input\output 均为json文件
   * ---
   * 内部直接调用 @done-coding/cli-inject
   */
  JSON_INJECT = "json-inject",
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
  extends ExtractInputKeyConfigBase<ExtractTypeEnum.REG>,
    Omit<InjectKeyConfigReg, "type" | "sourceKey"> {}

/** 提取配置直接读取 */
export interface ExtractInputKeyConfigJsonInject
  extends ExtractInputKeyConfigBase<ExtractTypeEnum.JSON_INJECT> {
  inject: InjectKeyConfig;
}

/** 提取配置 */
export type ExtractInputKeyConfig =
  | ExtractInputKeyConfigReg
  | ExtractInputKeyConfigJsonInject;

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
