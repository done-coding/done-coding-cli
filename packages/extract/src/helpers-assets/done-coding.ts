import { ExtractTypeEnum, type ExtractConfig } from "../utils";
import { InjectTypeEnum } from "@done-coding/cli-inject";
import { OutputModeEnum } from "@done-coding/cli-template";

const injectInputData = {
  name: `\${name}`,
  version: `\${version}`,
  description: `\${description}`,
  cliConfig: {
    namespaceDir: `\${cliConfig.namespaceDir}`,
    moduleName: `\${cliConfig.moduleName}`,
  },
};

/** done-coding 系列cli 注入信息 */
export const doneCodingSeriesCliInjectInfo: ExtractConfig = {
  extractInput: {
    "./package.json": {
      name: {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          type: InjectTypeEnum.READ,
        },
      },
      description: {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          type: InjectTypeEnum.READ,
        },
      },
      version: {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          type: InjectTypeEnum.READ,
        },
      },
      "cliConfig.namespaceDir": {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          type: InjectTypeEnum.FIXED,
          value: ".done-coding",
        },
      },
      "cliConfig.moduleName": {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          sourceKey: "name",
          type: InjectTypeEnum.REG,
          pattern: /@done-coding\/cli-([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)/.source,
          replaceValue: "$1",
        },
      },
    },
  },
  extractOutput: {
    list: [
      {
        mode: OutputModeEnum.OVERWRITE,
        inputData: JSON.stringify(injectInputData, null, 2),
        output: "./src/extractInfo.json",
      },
    ],
  },
};

const publishAliasInputData = {
  npm: {
    aliasInfo: [
      {
        packageJson: {
          name: `\${organizationAbbr}-\${moduleName}`,
          bin: `\${binEntry}`,
          scripts: {},
        },
      },
    ],
  },
};

/** done-coding 系列cli 别名发布信息 */
export const doneCodingPublishAliasInfo: ExtractConfig = {
  extractInput: {
    "./package.json": {
      name: {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          type: InjectTypeEnum.READ,
        },
      },
      bin: {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          type: InjectTypeEnum.READ,
        },
      },
      organization: {
        type: ExtractTypeEnum.FIXED,
        value: "done-coding",
      },
      /** 组织名缩写 */
      organizationAbbr: {
        type: ExtractTypeEnum.FIXED,
        value: "dc",
      },
      binEntry: {
        type: ExtractTypeEnum.FIXED,
        value: "es/cli.mjs",
      },
      moduleName: {
        type: ExtractTypeEnum.JSON_INJECT,
        inject: {
          sourceKey: "name",
          type: InjectTypeEnum.REG,
          pattern: /@done-coding\/cli-([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)/.source,
          replaceValue: "$1",
        },
      },
    },
  },
  extractOutput: {
    list: [
      {
        mode: OutputModeEnum.OVERWRITE,
        inputData: JSON.stringify(publishAliasInputData, null, 2),
        output: "./.done-coding/publish.json",
      },
    ],
  },
};
