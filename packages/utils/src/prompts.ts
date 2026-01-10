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

/** prompts 拓展 */
export const xPrompts = <T extends string = string>(
  ...args: Parameters<typeof prompts<T>>
) => {
  const [questions, options = {}] = args;
  return prompts(questions, {
    onCancel(params) {
      log.error(`退出${params?.name}输入`);
      return process.exit(1);
    },
    ...options,
  });
};
