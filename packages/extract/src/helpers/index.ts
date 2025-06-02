import { ExtractTypeEnum, type ExtractConfig } from "@/utils";
import { InjectTypeEnum } from "@done-coding/cli-inject";
import { OutputModeEnum } from "@done-coding/cli-template";

const inputData = {
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
        inject: ".done-coding",
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
        inputData: JSON.stringify(inputData, null, 2),
        output: "./src/extractInfo.json",
      },
    ],
  },
};
