import type { CompileOptions } from "@done-coding/cli-template";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 新增组件 */
  ADD = "add",
  /** 移除组件 */
  REMOVE = "remove",
  /** 展示列表 */
  LIST = "list",
}

export interface AddOptions {
  /**
   * 组件名
   */
  name: string;
}

export interface RemoveOptions {
  /**
   * 组件名
   */
  name?: string;
}

/** 模版配置输入路径 */
export type TemplateConfigInputByPath = Pick<
  CompileOptions,
  "input" | "output"
>;

/** 模版配置输入数据 */
export type TemplateConfigInputByData = Pick<
  CompileOptions,
  "inputData" | "output"
>;

/** 模版配置 */
export type TemplateConfig =
  | TemplateConfigInputByPath
  | TemplateConfigInputByData;

/** 模版配置完整 */
export type TemplateConfigFull = Pick<
  CompileOptions,
  "input" | "inputData" | "output"
>;

/** 列表item */
export interface ConfigListItem {
  /** 入口文件 */
  entry: TemplateConfig;
  /** 索引文件 */
  index?: TemplateConfig;
}

/** 组件配置 */
export interface Config {
  /** 组件系列 */
  series: string;
  /** 组件名排除列表 */
  nameExcludes: string[];
  /** 组件目录 */
  componentDir: string;
  /** 配置列表 */
  list: ConfigListItem[];
}
