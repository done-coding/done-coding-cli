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

export interface Options {
  /** 环境数据(json)文件(优先级高于 envData ) */
  env?: string;
  /** 环境变量数据(JSON字符串) */
  envData?: string;
  /** 模板文件相对路径(优先级高于 inputData ) */
  input?: string;
  /** 模板数据 */
  inputData?: string;
  /** 输出文件相对路径 */
  output: string;
  /** 输出模式 @default OutputModeEnum.OVERWRITE */
  mode: OutputModeEnum;
  /** 是否回滚 @default false */
  rollback?: boolean;
}
