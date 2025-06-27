/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import type { InjectConfig } from "../types";
import { InjectTypeEnum } from "../types";

/** done-coding-cli 注入配置 */
export const doneCodingCliConfig: InjectConfig = {
  sourceFilePath: "./package.json",
  keyConfigMap: {
    name: {
      type: InjectTypeEnum.READ,
    },
    version: {
      type: InjectTypeEnum.READ,
    },
    description: {
      type: InjectTypeEnum.READ,
    },
    bin: {
      type: InjectTypeEnum.READ,
    },
    "cliConfig.namespaceDir": {
      type: InjectTypeEnum.FIXED,
      value: ".done-coding",
    },
    "cliConfig.moduleName": {
      type: InjectTypeEnum.REG,
      sourceKey: "name",
      pattern: /@done-coding\/cli-([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)/.source,
      replaceValue: "$1",
    },
  },
  injectFilePath: "./src/injectInfo.json",
};
