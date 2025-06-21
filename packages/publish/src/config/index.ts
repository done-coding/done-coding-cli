import { PublishModeEnum, type ConfigInfo } from "@/types";

const config: ConfigInfo = {
  [PublishModeEnum.WEB]: {},
  [PublishModeEnum.NPM]: {
    aliasInfo: [
      {
        packageJson: {
          name: "",
          bin: "",
          scripts: {},
        },
      },
    ],
  },
};

export default config;
