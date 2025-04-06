import type { Options as TemplateOptions } from "@done-coding/cli-template";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 新增组件 */
  ADD = "add",
  /** 移除组件 */
  REMOVE = "remove",
  /** 展示列表 */
  LIST = "list",
}

export interface Options {
  /**
   * 组件名
   * ---
   * 新增时必传
   */
  name?: string;
}

/** 模版配置输入路径 */
export type TemplateConfigInputByPath = Pick<
  TemplateOptions,
  "input" | "output"
>;

/** 模版配置输入数据 */
export type TemplateConfigInputByData = Pick<
  TemplateOptions,
  "inputData" | "output"
>;

/** 模版配置 */
export type TemplateConfig =
  | TemplateConfigInputByPath
  | TemplateConfigInputByData;

/** 模版配置完整 */
export type TemplateConfigFull = Pick<
  TemplateOptions,
  "input" | "inputData" | "output"
>;

/** 列表item */
export interface ConfigListItem {
  /** 组件逻辑文件 */
  entry: TemplateConfig;
  /** 组件逻辑文件 */
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
