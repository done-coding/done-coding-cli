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

/**
 * 获取答案 考虑mcp情况
 * ----
 * mcp 只拿预设值，非mcp优先拿默认值
 * 有预设值的场景: MCP
 */
export const getAnswerWithMCP = async <V = unknown, T extends string = string>({
  isMCP,
  key,
  presetAnswer,
  defaultValue,
  questionConfig,
}: {
  /** 是否mcp场景 */
  isMCP: boolean;
  /** 表单key */
  key: T;
  /** 预设答案所在的对象 */
  presetAnswer?: object & {
    [K in T]: any;
  };
  /** 默认值 */
  defaultValue?: V;
  /** 表单问询配置 */
  questionConfig: Parameters<typeof prompts<T>>[0];
}): Promise<V> => {
  if (isMCP) {
    const res = presetAnswer?.[key];
    if (res === undefined) {
      log.error(`MCP场景的约束值不能为空`);
      return process.exit(1);
    }
    return res;
  } else {
    return (
      presetAnswer?.[key] ??
      defaultValue ??
      (await xPrompts(questionConfig))[key]
    );
  }
};

/** 快捷获取答案 */
export const getAnswerSwift = async <V = unknown, T extends string = string>(
  key: T,
  /** 表单问询配置 */
  questionConfig: Parameters<typeof prompts<T>>[0],
): Promise<V> => {
  return (await xPrompts(questionConfig))[key];
};
