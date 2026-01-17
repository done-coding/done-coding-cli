/** 表单name枚举 */
export enum FormNameEnum {
  /** 项目名称选择 */
  PROJECT_NAME = "projectName",
  /** 模板选择 */
  TEMPLATE = "template",
  /** 是否保留git记录 */
  IS_SAVE_GIT_HISTORY = "saveGitHistory",
  /** 转换为ssh url */
  IS_TRANS_HTTP_URL_TO_SSH_URL = "isTransToSshUrl",
  /** 是否移除同名目录 */
  IS_REMOVE_SAME_NAME_DIR = "isRemove",
  /** 是否更改分支名-当指定模板分支时(即本地是否需要重命名分支名) */
  IS_CHANGE_BRANCH_NAME = "isChangeBranchName",
  /** （如果要改分支名）本地分支名 */
  LOCAL_BRANCH_NAME = "localBranchName",
  /** 是否浅克隆 */
  IS_SHALLOW_CLONE = "shallowClone",
  /** 自定义模板路径 */
  CUSTOM_GIT_URL_INPUT = "customUrl",
  /** git的提交信息 */
  GIT_COMMIT_MESSAGE = "gitCommitMessage",
  /**
   *  模板仓库地址
   * ----
   * 为mcp拓展所加
   */
  TEMPLATE_GIT_PATH = "templateGitPath",
  /** 模板仓库分支 */
  TEMPLATE_GIT_BRANCH = "templateGitBranch",
}
