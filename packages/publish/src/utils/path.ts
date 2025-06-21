import injectInfo from "@/injectInfo.json";
import { tmpdir } from "node:os";

/** 别名发布(新包构造)临时目录 */
export const PUBLISH_ALIAS_TEMP_DIR = `${tmpdir()}/.DONE_CODING_CLI/PUBLISH_ALIAS_TEMP_DIR`;

const {
  cliConfig: { namespaceDir, moduleName },
} = injectInfo;

/** 模块配置相对路径 */
export const MODULE_CONFIG_RELATIVE_PATH = `./${namespaceDir}/${moduleName}`;

/** 模块默认配置文件相对路径 */
export const MODULE_DEFAULT_CONFIG_RELATIVE_PATH = `${MODULE_CONFIG_RELATIVE_PATH}.json`;
