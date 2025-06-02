import type { InjectConfig } from "@/utils";
import { ConfigTypeEnum } from "@/utils";

const config: InjectConfig = {
  sourceFilePath: "./package.json",
  injectConfig: {
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
