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

/** 输入模式枚举 */
export enum InputModeEnum {}

/** 初始化选项 */
export type InitOptions = InitConfigFileOptions;

/** 单key提取配置 */
export interface ExtractGenerateKeyConfig {
  sourceKey: string;
}

/** 提取生成配置 */
export interface ExtractGenerateConfig {
  [key: string]: ExtractGenerateKeyConfig;
}

/** 生成选项 */
export type GenerateOptions = ReadConfigFileOptions;
