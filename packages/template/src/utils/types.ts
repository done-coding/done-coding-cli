/** 输出模式 */
export enum OutputModeEnum {
  /** 覆盖模式 */
  OVERWRITE = "overwrite",
  /** 追加模式 */
  APPEND = "append",
}

export interface Options {
  /** 环境数据文件相对路径 */
  envData: string;
  /** 环境数据文件JSON文件相对路径(优先级高于envData) */
  envJson: string;
  /** 输出文件相对路径 */
  output: string;
  /** 模板文件相对路径 */
  input: string;
  /** 输出模式 */
  mode: OutputModeEnum;
}
