/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-23 23:09:08
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 11:06:03
 */
import { FormNameEnum } from "./formNameEnum";
import { McpCreateToolParams } from "./mcp";

export * from "./formNameEnum";

export { FormNameEnum };

export type { McpCreateToolParams };

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
  /** 是否跳过模板编译(不跳过则会在克隆完成后进行模板编译)
   * --
   * 为MCP模式预留 设置为true则不会进行模板编译
   */
  skipTemplateCompile?: boolean;
  /** 开启git细节优化(设置为true则会在克隆完成后进行git细节优化)
   * --
   * 为MCP模式预留 设置为false则不会进行git细节优化
   */
  openGitDetailOptimize?: boolean;
  // -------------
  /**
   * git细节优化:是否更改分支名
   */
  [FormNameEnum.IS_CHANGE_BRANCH_NAME]?: boolean;
  /**
   * git细节优化:需要更改本地分支名时的更改值
   */
  [FormNameEnum.LOCAL_BRANCH_NAME]?: string;
  /** git细节优化:是否保存模板仓库git历史记录
   */
  [FormNameEnum.IS_SAVE_GIT_HISTORY]?: boolean;
  /** git细节优化:是否将http url转换为ssh url
   */
  [FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL]?: boolean;
  /** git细节优化:git提交信息
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
