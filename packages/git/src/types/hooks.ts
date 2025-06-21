import { HooksNameEnum, ReadConfigFileOptions } from "@done-coding/cli-utils";

/** hooks选项 */
export type HooksOptions = ReadConfigFileOptions & {
  name: HooksNameEnum;
};
