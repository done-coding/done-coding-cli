import prompts from "prompts";
import { log } from "./log";
export type {
  Choice as PromptChoice,
  Options as PromptOptions,
  PromptObject,
  Answers as PromptAnswers,
  PrevCaller as PromptPrevCaller,
  Falsy as PromptFalsy,
  PromptType,
  ValueOrFunc as PromptValueOrFunc,
  InitialReturnValue as PromptInitialReturnValue,
} from "prompts";

/** @deprecated prompt表单-进程退出信号处理 */
export function onPromptFormStateForSigint(params: {
  aborted: boolean;
  value: any;
}) {
  if (params.aborted) {
    log.error("退出输入");
    return process.exit(1);
  }
}

/** prompts 拓展 */
export const xPrompts = (...args: Parameters<typeof prompts>) => {
  const [questions, options = {}] = args;
  return prompts(questions, {
    onCancel(params) {
      log.error(`退出${params?.name}输入`);
      return process.exit(1);
    },
    ...options,
  });
};
