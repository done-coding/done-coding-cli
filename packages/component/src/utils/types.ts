/** 子命令枚举 */
export enum SubcommandEnum {
  /** 新增组件 */
  ADD = "add",
  /** 移除组件 */
  REMOVE = "remove",
}

export interface Options {
  /**
   * 组件名
   * ---
   * 新增时必传
   */
  name?: string;
}
