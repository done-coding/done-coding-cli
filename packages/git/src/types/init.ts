import type { InitConfigFileOptions } from "@done-coding/cli-utils";

/** 初始化类型 */
export enum InitTypeEnum {
  DEFAULT = "default",
  CLONE_CONFIG = "cloneConfig",
}

/** 初始化选项 */
export interface InitOptions extends InitConfigFileOptions {
  type?: InitTypeEnum;
}
