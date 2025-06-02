/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import type { InjectConfig } from "../utils";
import { ConfigTypeEnum } from "../utils";

/** done-coding-cli 注入配置 */
export const doneCodingCliConfig: InjectConfig = {
  sourceFilePath: "./package.json",
  keyConfig: {
    name: {
      type: ConfigTypeEnum.READ,
    },
    version: {
      type: ConfigTypeEnum.READ,
    },
    description: {
      type: ConfigTypeEnum.READ,
    },
    "cliConfig.namespaceDir": {
      type: ConfigTypeEnum.FIXED,
      value: ".done-coding",
    },
    "cliConfig.moduleName": {
      type: ConfigTypeEnum.REG,
      sourceKey: "name",
      pattern: /@done-coding\/cli-([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)/.source,
      replaceValue: "$1",
    },
  },
  injectFilePath: "./src/injectInfo.json",
};
