import { FormNameEnum } from "./formNameEnum";
import { McpCreateAnswerPreset } from "./mcp";

export * from "./formNameEnum";

export { FormNameEnum };

export type { McpCreateAnswerPreset };

export enum SubcommandEnum {
  CREATE = "create",
}

export interface CreateOptions {
  /** 项目名称 */
  [FormNameEnum.PROJECT_NAME]?: string;
  /** 是否仅仅(从done-coding系列项目列表中)克隆远程仓库 */
  justCloneFromDoneCoding?: boolean;
  /** 模板仓库地址 */
  [FormNameEnum.TEMPLATE_GIT_PATH]?: string;
  /** 模板仓库分支 -- 不传则是默认分支 */
  [FormNameEnum.TEMPLATE_GIT_BRANCH]?: string;
  /** simple: 是否简单模式，不询问用户问题 */
  simple?: boolean;
  // -------------
  /**
   * 是否更改分支名-当指定模板分支时(即本地是否需要重命名分支名)
   */
  [FormNameEnum.IS_CHANGE_BRANCH_NAME]?: boolean;
  /**
   * （如果要改分支名）本地分支名
   */
  [FormNameEnum.LOCAL_BRANCH_NAME]?: string;
  /** 是否保存模板仓库git历史记录
   */
  [FormNameEnum.IS_SAVE_GIT_HISTORY]?: boolean;
  /** 转换为ssh url
   */
  [FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL]?: boolean;
  /** git的提交信息
   */
  [FormNameEnum.GIT_COMMIT_MESSAGE]?: string;
}

/** 创建模板-分支信息 */
export interface CreateTemplateBranchInfo {
  /** 分支名 */
  name: string;
  /** 描述 */
  description: string;
}

/** 模版选项 */
export interface CreateTemplateChoiceItem {
  /** 模板名 */
  name: string;
  /** 仓库地址 */
  url?: string;
  /** 描述 */
  description?: string;
  /** 目标分支 */
  branch?: string | CreateTemplateBranchInfo[];
  /** 应用实例 */
  instances?: string[];
}

export interface CreateConfigJson {
  templateList: CreateTemplateChoiceItem[];
}

/** 远程仓库别名枚举 */
export enum GitRemoteRepoAliasNameEnum {
  /** 默认 */
  ORIGIN = "origin",
  /** 模板仓库 */
  UPSTREAM = "upstream",
}
