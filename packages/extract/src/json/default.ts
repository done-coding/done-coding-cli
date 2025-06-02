import { ExtractTypeEnum, type ExtractConfig } from "@/utils";
import { InjectTypeEnum } from "@done-coding/cli-inject";
import { OutputModeEnum } from "@done-coding/cli-template";

const inputData = {
  name: `\${name}`,
  version: `\${version}`,
  description: `\${description}`,
};

export const config: ExtractConfig = {
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
    },
    "./README.md": {
      docDescription: {
        type: ExtractTypeEnum.REG,
        pattern: /#\s*([^`])+```([^`]+)```/.source,
        replaceValue: "",
      },
      usage: {
        type: ExtractTypeEnum.REG,
        pattern: /##\s*使用\s*```([^`]+)```/.source,
        replaceValue: "$1",
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
