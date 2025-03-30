export interface Options {
  /** 项目名称 */
  projectName: string;
  /** 项目模板 */
  template: string;
  /** 保存git历史记录 */
  saveGitHistory: boolean;
  /** 是否使用shallow clone */
  shallowClone: boolean;
}
