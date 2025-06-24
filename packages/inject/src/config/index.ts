/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import type { InjectConfig } from "../types";
import { InjectTypeEnum } from "../types";

const config: InjectConfig = {
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
  },
  injectFilePath: "./src/injectInfo.json",
};

export default config;
