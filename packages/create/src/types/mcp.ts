import { FormNameEnum } from "./formNameEnum";

/**
 * mcp项目创建答案预设
 */
export interface McpCreateAnswerPreset {
  /** 项目名称 */
  [FormNameEnum.PROJECT_NAME]: string;
  /** 模板仓库地址 */
  [FormNameEnum.TEMPLATE_GIT_PATH]: string;
  /** 模板仓库分支 */
  [FormNameEnum.TEMPLATE_GIT_BRANCH]?: string;
  // /**
  //  * 是否更改分支名-当指定模板分支时(即本地是否需要重命名分支名)
  //  * @deprecated mcp跳过这种细节 即不改分支名 甚至不git初始化
  // */
  // [FormNameEnum.IS_CHANGE_BRANCH_NAME]: boolean;
  // /** （如果要改分支名）本地分支名
  //  * @deprecated mcp跳过这种细节 即不改分支名 甚至不git初始化
  //  */
  // [FormNameEnum.LOCAL_BRANCH_NAME]: string
  // /** 是否保留git记录
  //  * @deprecated mcp跳过这种细节 即不保存
  //  */
  // [FormNameEnum.IS_SAVE_GIT_HISTORY]: boolean
  // /** 转换为ssh url
  //  * @deprecated mcp跳过这种细节 即不转换
  // */
  // [FormNameEnum.IS_TRANS_HTTP_URL_TO_SSH_URL]: boolean
  // /** git的提交信息
  //  * @deprecated mcp跳过这种细节 即不git初始化
  //  */
  // [FormNameEnum.GIT_COMMIT_MESSAGE]: string
}
