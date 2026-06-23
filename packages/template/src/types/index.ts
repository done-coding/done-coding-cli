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
  /** 批量编译模板 */
  BATCH = "batch",
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
  /** 插入模式（锚点 before/after 插入 + 语言感知 marker 健壮回退；additive，P2） */
  INSERT = "insert",
}

/** [INSERT 专用] 锚点定位（item 级，仅 INSERT mode 读；其余 mode 忽略） */
export interface InsertAnchor {
  /** 锚点匹配串（generator 侧已渲染 `${}`） */
  pattern: string;
  /** 相对锚点行的插入位置 */
  position: "before" | "after";
  /** 匹配方式，默认 "literal"（子串）；"regex" 按正则 */
  patternType?: "literal" | "regex";
}

/** [INSERT 可选] 覆盖语言感知注释样式 */
export interface InsertMarkerComment {
  open: string;
  close: string;
}

/** 编译模板配置项(原始的) */
export interface CompileTemplateConfigListItemRaw {
  /** 环境数据(json)文件(优先级高于 envData ) */
  env?: string;
  /** 环境变量数据(JSON字符串) */
  envData?: string;
  /** 模板文件相对路径(优先级高于 inputData ) */
  input?: string;
  /** 模板数据(JSON字符串) */
  inputData?: string;
  /** 输出文件相对路径 */
  output?: string;
  /** 输出模式 @default OutputModeEnum.OVERWRITE */
  mode: OutputModeEnum;
  /** item-level NS override; if absent, top-level markerNs from handler applies */
  markerNs?: string;
}

/** 编译公共选项 */
export interface CompilePublicConfig {
  /** 项目根目录 */
  rootDir: string;
  /**
   * 配置文件路径
   * ---
   * 不传拿默认值
   */
  configPath?: string;
  /**
   * 回滚删除空文件
   * ---
   * 只限 OutputModeEnum.APPEND 模式下生效
   */
  rollbackDelNullFile?: boolean;
  /** 回滚删除询问默认yes(即不再额外询问，直接认为同意) */
  rollbackDelAskAsYes?: boolean;
  /** (检测是markdown)是否处理(单个)代码块包裹 */
  dealMarkdown?: boolean;
  /**
   * APPEND remove 命中检测开关（item 级，经 batch handler ...rest 透传到 compileTemplate 第一参；默认 false=旧行为不变）
   */
  rollbackRequireHit?: boolean;
  /**
   * [INSERT 专用] 锚点（item 级，经第一参解构；其余 mode 忽略）。
   * generator 侧已渲染 pattern。
   */
  anchor?: InsertAnchor;
  /**
   * [INSERT 专用] marker 身份键（item 级，generator 侧已渲染）。
   * 文件内 marker 文本 = `<open> === dc-template:start:<markerKey> === <close>` / `...:end:...`。
   * 回退按 markerKey 精确定位，免疫块内手改。
   */
  markerKey?: string;
  /** [INSERT 可选] 覆盖语言感知注释样式（未知扩展名时必填，item 级） */
  markerComment?: InsertMarkerComment;
  /** [INSERT 专用] marker namespace（调用方注入，batch handler 灌入每个 item；design R-B1/R-B4） */
  markerNs?: string;
  /** 是否回滚 */
  rollback?: boolean;
}

/** 批量模板编译配置项 */

export interface CompileBatchOptions extends CompilePublicConfig {}

/** 批量编译 handler 额外选项 */
export interface CompileBatchHandlerOptions extends CompileBatchOptions {
  /** 额外的环境变量 */
  extraEnvData?: Record<string, any>;
  /** collectEnvDataForm 对应的已收集答案 */
  collectEnvData?: Record<string, any>;
}

/** 编译模板配置项 */
export interface CompileOptions
  extends CompilePublicConfig, CompileTemplateConfigListItemRaw {
  /**
   * 是否批量处理
   * --
   * 为true 走批量编译，此时configPath为批量编译配置文件路径 且必须
   */
  batch?: boolean;
}

/**
 * 编译模板配置选项
 */
export type CompileTemplateConfigListItem = Omit<
  CompileTemplateConfigListItemRaw &
    Omit<CompilePublicConfig, keyof ReadConfigFileOptions>,
  "envData" | "rollback"
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
  list?: CompileTemplateConfigListItemRaw[];
}
