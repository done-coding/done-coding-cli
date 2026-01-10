export enum SubcommandEnum {
  CREATE = "create",
}

export interface CreateOptions {
  /** 项目名称 */
  projectName?: string;
  /** 是否仅仅(从done-coding系列项目列表中)克隆远程仓库 */
  justCloneFromDoneCoding?: boolean;
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
