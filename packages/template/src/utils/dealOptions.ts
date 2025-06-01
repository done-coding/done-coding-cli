import { OutputModeEnum, type CompileOptions } from "./types";

/** 默认选项 */
export const defaultOptions: Pick<
  CompileOptions,
  "rollback" | "dealMarkdown" | "mode" | "batch"
> = {
  rollback: false,
  dealMarkdown: false,
  mode: OutputModeEnum.OVERWRITE,
  batch: false,
};

/** 设置默认选项 */
export const completeDefaultOptions = <T extends typeof defaultOptions>(
  options: T,
) => {
  const { rollback, dealMarkdown, mode, batch, ...rest } = options;
  return {
    rollback: rollback ?? defaultOptions.rollback,
    dealMarkdown: dealMarkdown ?? defaultOptions.dealMarkdown,
    mode: mode ?? defaultOptions.mode,
    batch: batch ?? defaultOptions.batch,
    ...rest,
  };
};
