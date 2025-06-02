/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */
/** 考虑本包会使用当前文件源码 避免不识别@ 此处用相对路径 */

import type { InjectConfig } from "../utils";
import { ConfigTypeEnum } from "../utils";

const config: InjectConfig = {
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
  },
  injectFilePath: "./src/injectInfo.json",
};

export default config;
