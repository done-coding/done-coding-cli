/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-30 21:15:09
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-01-30 21:50:06
 */
import {
  EnvConfigCallModeEnum,
  updateEnvConfig,
  log,
} from "@done-coding/cli-utils";
import { createServer } from "@done-coding/mcp-utils";
import {
  toolRegisterList,
  resourceRegisterList,
  promptRegisterList,
} from "./mcp-config.js";
import injectInfo from "@/injectInfo.json";

/** 启动 MCP 服务 */
export const setupMcpServer = async () => {
  // 初始化环境配置
  updateEnvConfig({
    callMode: EnvConfigCallModeEnum.MCP,
    consoleLog: false,
  });

  // 创建 MCP 服务
  await createServer({
    toolRegisterList,
    resourceRegisterList,
    promptRegisterList,
    name: injectInfo.name,
    version: injectInfo.version,
  }).catch((error) => {
    log.error("MCP 服务启动失败:", error);
    process.exit(1);
  });
};
