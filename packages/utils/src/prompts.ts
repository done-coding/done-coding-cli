/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-01-23 23:09:08
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-04-01 11:18:17
 */
import {
  getProcessCreateByHijackPresetInfo,
  outputConsole,
  processIsHijacked,
} from "@/env-config";
import prompts from "prompts";
import {
  createPromptsStartWaitUserInputEvent,
  createPromptsEndWaitUserInputEvent,
  processSendCustomEvent,
} from "@/_event";
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
export const xPrompts = async <T extends string = string>(
  ...args: Parameters<typeof prompts<T>>
) => {
  const [questions, options = {}] = args;
  const isHijackedProcess = processIsHijacked();

  // 是否劫持进程创建的，则发送开始等待用户输入事件
  if (isHijackedProcess) {
    await processSendCustomEvent(createPromptsStartWaitUserInputEvent(args));
    const processCreateByHijackPresetInfo =
      getProcessCreateByHijackPresetInfo();
    if (processCreateByHijackPresetInfo?.beforeInputExit) {
      outputConsole.info(
        `劫持进程设置在等待用户输入前退出`,
        JSON.stringify(processCreateByHijackPresetInfo),
      );
      const questionsInit = args[0];
      const questions = Array.isArray(questionsInit)
        ? questionsInit
        : [questionsInit];
      outputConsole.info(
        `检测到子进程等待用户输入${questions.map((question) => `${question.name}: ${question.message}`).join(", ")}`,
      );
      outputConsole.error(
        `进程退出，原因: 检测到子进程要等待用户输入，此处子进程自己退出`,
      );
      return process.exit(1);
    }
  }
  const res = prompts(questions, {
    onCancel(params) {
      const formName = (params?.message || params?.name || "")
        .toString()
        .replace(/^(请?输入)|(请?选择)/, "");
      outputConsole.error(`您取消了"${formName}"相关表单输入`);
      return process.exit(1);
    },
    ...options,
  });

  // 是否劫持进程创建的，则发送结束等待用户输入事件
  if (isHijackedProcess) {
    res.finally(() => {
      processSendCustomEvent(createPromptsEndWaitUserInputEvent());
    });
  }

  return res;
};

/** 获取答案 考虑mcp情况 的选项 */
export interface GetAnswerOptions<V, T extends string> {
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
  key,
  presetAnswer,
  defaultValue,
  questionConfig,
}: GetAnswerOptions<V, T>): GetAnswerResult<V, T, typeof questionConfig> => {
  // 预设值
  const presetValue = presetAnswer?.[key];
  return (
    presetValue ??
    defaultValue ??
    (questionConfig !== undefined
      ? (await xPrompts(questionConfig))[key]
      : undefined)
  );
};

/** 生成 获取答案的快捷函数 */
export const generateGetAnswerSwiftFn = ({
  presetAnswer,
}: Pick<GetAnswerOptions<unknown, string>, "presetAnswer">) => {
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
      presetAnswer,
    }) as GetAnswerResult<V, T, typeof questionConfig>;
  };
};
