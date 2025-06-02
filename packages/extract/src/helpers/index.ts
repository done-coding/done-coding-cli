import { ExtractTypeEnum, type ExtractConfig } from "@/utils";
import { OutputModeEnum } from "@done-coding/cli-template";

/** done-coding 系列cli 注入信息 */
export const doneCodingSeriesCliInjectInfo: ExtractConfig = {
  extractInput: {
    "./packages.json": {
      name: {
        type: ExtractTypeEnum.READ,
      },
      description: {
        type: ExtractTypeEnum.READ,
      },
      version: {
        type: ExtractTypeEnum.READ,
      },
      "cliConfig.moduleName": {
        type: ExtractTypeEnum.REG,
        sourceKey: "name",
        pattern: /@done-coding\/cli-([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*)/.source,
        replaceValue: "$1",
      },
    },
  },
  extractOutput: {
    globalEnvData: {
      "cliConfig.namespaceDir": ".done-coding",
    },
    list: [
      {
        mode: OutputModeEnum.OVERWRITE,
        inputData: `{
  "version": "\${version}",
  "name": "\${name}",
  "description": "\${description}",
  "cliConfig": {
    "namespaceDir": "\${cliConfig.namespaceDir}",
    "moduleName": "\${cliConfig.moduleName}"
  }
}`,
        output: "./src/injectInfo.json",
      },
    ],
  },
};
