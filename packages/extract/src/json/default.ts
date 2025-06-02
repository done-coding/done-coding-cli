import { ExtractTypeEnum, type ExtractConfig } from "@/utils";
import { OutputModeEnum } from "@done-coding/cli-template";

export const config: ExtractConfig = {
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
    },
  },
  extractOutput: {
    list: [
      {
        mode: OutputModeEnum.OVERWRITE,
        inputData: `{
  "version": "\${version}",
  "name": "\${name}",
  "description": "\${description}"
}`,
        output: "./src/injectInfo.json",
      },
    ],
  },
};
