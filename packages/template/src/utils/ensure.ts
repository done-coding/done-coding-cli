import type { OutputModeEnum } from "@/types";
import { log } from "@done-coding/cli-utils";

/** 确保output不为空 */
export const ensureOutputNotNull = (mode: OutputModeEnum, output?: string) => {
  if (!output) {
    log.error(`${mode}模式下output不能为空`);
    return process.exit(1);
  }
};

/** 确保output与input不相同 */
export const ensureOutputNotEqualsInput = (output?: string, input?: string) => {
  if (input && output === input) {
    log.error(`output与input不能相同`);
    return process.exit(1);
  }
};

/** 确保input不为空 */
export const ensureInputNotNull = (mode: OutputModeEnum, input?: string) => {
  if (!input) {
    log.error(`${mode}模式下input不能为空`);
    return process.exit(1);
  }
};
