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

/** 获取答案 考虑mcp情况 的选项 */
export interface GetAnswerOptions<V, T extends string> {
  /** 是否mcp场景 */
  isMCP?: boolean;
  /** 表单key */
  key: T;
  /** 预设答案所在的对象 */
  presetAnswer?: object & {
    [K in T]?: any;
  };
  /** 默认值 */
  defaultValue?: V;
  /** 表单问询配置 */
  questionConfig?: Parameters<typeof prompts<T>>[0];
}

/** 获取答案结果类型 */
export type GetAnswerResult<
  V,
  T extends string,
  Q extends GetAnswerOptions<V, T>["questionConfig"],
> = Promise<Q extends undefined ? V | undefined : V>;

/**
 * 获取答案 考虑mcp情况
 * ----
 * mcp 只拿预设值，非mcp优先拿默认值
 * 有预设值的场景: MCP
 */
export const getAnswer = async <V = unknown, T extends string = string>({
  isMCP,
  key,
  presetAnswer,
  defaultValue,
  questionConfig,
}: GetAnswerOptions<V, T>): GetAnswerResult<V, T, typeof questionConfig> => {
  // 预设值
  const presetValue = presetAnswer?.[key];
  if (presetValue !== undefined) {
    return presetValue;
  } else if (isMCP) {
    log.error(`MCP场景的预设值不能为空`);
    return process.exit(1);
  }
  return (
    defaultValue ??
    (questionConfig !== undefined
      ? (await xPrompts(questionConfig))[key]
      : undefined)
  );
};

/** 生成 获取答案的快捷函数 */
export const generateGetAnswerSwiftFn = ({
  isMCP,
  presetAnswer,
}: Pick<GetAnswerOptions<unknown, string>, "isMCP" | "presetAnswer">) => {
  return async <V = unknown, T extends string = string>(
    key: T,
    /** 表单问询配置 */
    questionConfig?: Parameters<typeof prompts<T>>[0],
    /** 默认值 */
    defaultValue?: V,
  ) => {
    return getAnswer({
      key,
      questionConfig,
      defaultValue,
      isMCP,
      presetAnswer,
    }) as GetAnswerResult<V, T, typeof questionConfig>;
  };
};
