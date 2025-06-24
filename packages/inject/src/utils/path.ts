/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import injectInfo from "../injectInfo.json";

const {
  cliConfig: { namespaceDir, moduleName },
} = injectInfo;

/** 模块配置相对路径 */
export const MODULE_CONFIG_RELATIVE_PATH = `./${namespaceDir}/${moduleName}`;

/** 模块默认配置文件相对路径 */
export const MODULE_DEFAULT_CONFIG_RELATIVE_PATH = `${MODULE_CONFIG_RELATIVE_PATH}.json`;
