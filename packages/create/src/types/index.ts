/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-23 23:09:08
 * @LastEditors  : JustSoSu
 * @LastEditTime : 2026-04-14 15:44:31
 */
import { FormNameEnum } from "./formNameEnum";

export * from "./formNameEnum";

export { FormNameEnum };

/** create 包子命令枚举 */
export enum SubcommandEnum {
  /** 创建项目命令 */
  CREATE = "create",
}

/** 创建模板来源类型 */
export enum CreateTemplateSourceTypeEnum {
  /** git 仓库模板 */
  GIT = "git",
  /** 本地目录模板 */
  LOCAL = "local",
}

/** 创建项目命令参数 */
export interface CreateOptions {
  /** 创建项目的根目录 */
  rootDir?: string;
  /** 项目名称 */
  [FormNameEnum.PROJECT_NAME]?: string;
  /** 是否仅仅(从done-coding系列项目列表中)克隆远程仓库 */
  justCloneFromDoneCoding?: boolean;
  /** 模板地址，远程 git 地址或本地绝对路径 */
  [FormNameEnum.TEMPLATE_URL]?: string;
  /** 模板仓库地址 @deprecated 使用 templateUrl */
  [FormNameEnum.TEMPLATE_GIT_PATH]?: string;
  /** 模板仓库分支 -- 不传则是默认分支 */
  [FormNameEnum.TEMPLATE_GIT_BRANCH]?: string;
  /** 仓库内模板目录 */
  templateDirectory?: string;
  /**
   * 模板列表配置文件路径（本地）
   * ---
   * 指向一个 `{ templateList: [...] }` 配置文件。优先级：本选项 > home 指针文件
   * (`~/.done-coding/create/index.json`) > 内置远端配置。
   * MCP 列表工具下为必填；CLI 选填（不传则回落 home 指针 / 内置远端）。
   */
  templateConfig?: string;
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

/** create prepare 返回的模板预置问题 */
export interface CreatePrepareQuestion {
  key: string;
  label: string;
  initial?: string;
}

/** create prepare 结果 */
export type CreatePrepareResult =
  | {
      status: "ready";
      draftId: string;
      projectPath: string;
      draftProjectPath: string;
    }
  | {
      status: "need_input";
      draftId: string;
      projectPath: string;
      draftProjectPath: string;
      questions: CreatePrepareQuestion[];
    };

/** create complete 入参 */
export interface CreateCompleteOptions extends CreateOptions {
  /** prepare 阶段返回的草稿 ID */
  draftId: string;
  /** 模板预置问题答案 */
  envData?: Record<string, any>;
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
  /** 模板 git 仓库地址，远程 git 地址或本地 git 仓库根路径 */
  url?: string;
  /** 仓库内模板目录 */
  directory?: string;
  /** 描述 */
  description?: string;
  /** 目标分支 */
  branch?: string | CreateTemplateBranchInfo[];
  /** 应用实例 */
  instances?: string[];
}

/** create 包配置文件结构 */
export interface CreateConfigJson {
  /** 可选模板列表 */
  templateList: CreateTemplateChoiceItem[];
}

/** 远程仓库别名枚举 */
export enum GitRemoteRepoAliasNameEnum {
  /** 默认 */
  ORIGIN = "origin",
  /** 模板仓库 */
  UPSTREAM = "upstream",
}
