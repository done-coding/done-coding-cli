/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-17 19:08:44
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-08 11:05:17
 */
import { McpCommonToolParams } from "@done-coding/mcp-utils";
import { FormNameEnum } from "./formNameEnum";

/**
 * mcp项目创建工具参数
 */
export interface McpCreateToolParams extends McpCommonToolParams {
  /** 项目名称 */
  [FormNameEnum.PROJECT_NAME]: string;
  /** 模板仓库地址 */
  [FormNameEnum.TEMPLATE_GIT_PATH]: string;
  /** 模板仓库分支 */
  [FormNameEnum.TEMPLATE_GIT_BRANCH]?: string;
}
