/** done-coding 全局环境配置symbol 描述 */
export const DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL_DESC =
  "__DONE_CODING_ENV_CONFIG__";

/** done-coding 全局环境配置symbol */
export const DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL = Symbol.for(
  DONE_CONFIG_ENV_CONFIG_GLOBAL_SYMBOL_DESC,
);

/** done-coding 【全局/临时】文件相对目录 */
export const DONE_CODING_CONFIG_RELATIVE_DIR = ".done-coding";

/** done-coding-cli 【临时】本地资产配置仓库相对目录 */
export const DONE_CODING_CLI_TEMP_ASSETS_CONFIG_RELATIVE_DIR = `${DONE_CODING_CONFIG_RELATIVE_DIR}/cli/assets-config`;

/** done-coding-cli 资产配置仓库 各模块的父文件夹 */
export const DONE_CODING_CLI_ASSETS_CONFIG_REPO_DIR_NAME = "assets";

/** done-coding-cli 资产配置仓库 各模块的入口文件 */
export const DONE_CODING_CLI_ASSETS_CONFIG_REPO_MODULE_ENTRY = "index.json";

/** done-coding-cli 【全局】配置文件相对路径 */
export const DONE_CODING_CLI_GLOBAL_CONFIG_RELATIVE_PATH = `${DONE_CODING_CONFIG_RELATIVE_DIR}/config.json`;

/** done-coding 日志输出文件夹名 */
export const DONE_CODING_LOG_OUTPUT_DIR_NAME = "output/log";

/** done-coding 日志输出对应的系列 - 默认值 */
export const DONE_CODING_SERIES_DEFAULT = "default";

/** cli 资产配置仓库地址_默认 */
export const ASSETS_CONFIG_REPO_URL_DEFAULT =
  "https://gitee.com/justsosu/done-coding-cli-assets-config.git";
