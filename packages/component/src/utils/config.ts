import path from "node:path";
import fs from "node:fs";
import { getPathEnvData, getTemplateDirAbsolutePath } from "./env-data";
import _template from "lodash.template";
import { log, json5 } from "@done-coding/cli-utils";
import type { Config } from "@/types";

/** 获取配置 */
export const getConfig = () => {
  /** 模块入口文件 */
  const moduleIndex = path.resolve(getTemplateDirAbsolutePath(), "index.json");
  if (!fs.existsSync(moduleIndex)) {
    log.error(`模块入口文件不存在: ${moduleIndex}`);
    return process.exit(1);
  }
  /** 模块入口文件内容 */
  const indexContent = JSON.parse(fs.readFileSync(moduleIndex, "utf-8"));
  /** 配置文件相对路径 */
  const configRelativePath = indexContent.config;

  if (!configRelativePath) {
    log.error(`配置文件相对路径不存在: ${configRelativePath}`);
    return process.exit(1);
  }

  /** 配置文件路径 */
  const configPath = path.resolve(
    path.dirname(moduleIndex),
    configRelativePath,
  );
  if (!fs.existsSync(configPath)) {
    log.error(`配置文件不存在: ${configPath}`);
    return process.exit(1);
  }
  /** 配置文件内容 */
  const config = json5.parse(fs.readFileSync(configPath, "utf-8")) as Config;

  const pathEnvData = getPathEnvData();

  /** 组件目录-绝对路径 */
  config.componentDir = _template(config.componentDir)(pathEnvData);

  return config;
};
