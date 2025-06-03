import injectInfo from "../injectInfo.json";

const {
  cliConfig: { namespaceDir, moduleName },
} = injectInfo;

/** 模块配置相对路径 */
export const MODULE_CONFIG_RELATIVE_PATH = `./${namespaceDir}/${moduleName}`;
