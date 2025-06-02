import type {
  InitConfigFileOptions,
  ReadConfigFileOptions,
} from "@done-coding/cli-utils";

/** 子命令枚举 */
export enum SubcommandEnum {
  /** 初始化模板 */
  INIT = "init",
  /** 编译模板 */
  COMPILE = "compile",
}

export type InitOptions = InitConfigFileOptions;

/** 绑定的关键变量枚举 */
export enum TemplateBindKeyEnum {
  /** 远程仓库地址 */
  REPOSITORY_URL = "REPOSITORY_URL",
}

/** 输出模式 */
export enum OutputModeEnum {
  /** 覆盖模式 */
  OVERWRITE = "overwrite",
  /** 追加模式 */
  APPEND = "append",
  /** 替换模式 */
  REPLACE = "replace",
  /** 返回模式--函数调用方式可用 */
  RETURN = "return",
}

export interface CompileOptions {
  /** 项目根目录 */
  rootDir: string;
  /** 配置文件路径 */
  configPath?: string;
  /** 环境数据(json)文件(优先级高于 envData ) */
  env?: string;
  /** 环境变量数据(JSON字符串) */
  envData?: string;
  /** 模板文件相对路径(优先级高于 inputData ) */
  input?: string;
  /** 模板数据 */
  inputData?: string;
  /** 输出文件相对路径 */
  output?: string;
  /** 输出模式 @default OutputModeEnum.OVERWRITE */
  mode: OutputModeEnum;
  /** 是否回滚 @default false */
  rollback?: boolean;
  /**
   * 回滚删除空文件
   * ---
   * 只限 OutputModeEnum.APPEND 模式下生效
   */
  rollbackDelNullFile?: boolean;
  /** (检测是markdown)是否处理(单个)代码块包裹 */
  dealMarkdown?: boolean;
  /** 是否批量处理 */
  batch?: boolean;
}

/**
 * 编译模板配置选项
 */
export type CompileTemplateConfigListItem = Omit<
  CompileOptions,
  "envData" | keyof ReadConfigFileOptions
> & {
  /** 已经解析为对象的envData */
  envData: Record<string, any>;
};

/** 采集环境变量配置 */
export interface CollectFormItem {
  /** 采集环境变量的key */
  key: string;
  /** 采集环境变量标签 */
  label: string;
  /** 采集环境变量初始值 */
  initial?: string;
  /** 绑定的关键变量 */
  bindKey?: TemplateBindKeyEnum;
}

/** 编译模板配置 */
export interface CompileTemplateConfig {
  /** 全局环境变量 */
  globalEnvData?: Record<string, any>;
  /** 采集环境变量表单配置 */
  collectEnvDataForm?: (CollectFormItem | string)[];
  /** 配置列表 */
  list?: Omit<CompileOptions, keyof ReadConfigFileOptions>[];
}
