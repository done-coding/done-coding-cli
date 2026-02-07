/*
 * @Description  :
 * @Author       : supengfei
 * @Date         : 2026-02-03 19:57:31
 * @LastEditors  : supengfei
 * @LastEditTime : 2026-02-05 21:43:42
 */
import type prompts from "prompts";
import { outputConsole } from "./env-config";

/** @deprecated 进程事件名称映射 */
export const PROCESS_EVENT_NAME_MAP = {
  /** prompts 开始等待用户输入 */
  PROMPTS_START_WAIT_USER_INPUT: "PROMPTS_START_WAIT_USER_INPUT",
  /** prompts 结束等待用户输入 */
  PROMPTS_END_WAIT_USER_INPUT: "PROMPTS_END_WAIT_USER_INPUT",
} as const;

/** prompts 开始等待用户输入事件 */
export interface PromptsStartWaitUserInputEvent {
  type: typeof PROCESS_EVENT_NAME_MAP.PROMPTS_START_WAIT_USER_INPUT;
  data: Parameters<typeof prompts<string>>;
}

/** prompts 结束等待用户输入事件 */
export interface PromptsEndWaitUserInputEvent {
  type: typeof PROCESS_EVENT_NAME_MAP.PROMPTS_END_WAIT_USER_INPUT;
}

/** 创建 prompts 开始等待用户输入事件 */
export const createPromptsStartWaitUserInputEvent = (
  data: Parameters<typeof prompts<string>>,
): PromptsStartWaitUserInputEvent => {
  return {
    type: PROCESS_EVENT_NAME_MAP.PROMPTS_START_WAIT_USER_INPUT,
    data,
  };
};

/** 创建 prompts 结束等待用户输入事件 */
export const createPromptsEndWaitUserInputEvent =
  (): PromptsEndWaitUserInputEvent => {
    return {
      type: PROCESS_EVENT_NAME_MAP.PROMPTS_END_WAIT_USER_INPUT,
    };
  };

/** 进程自定义事件 */
export type ProcessCustomEvent =
  | PromptsStartWaitUserInputEvent
  | PromptsEndWaitUserInputEvent;

/** 发送进程自定义事件 */
export const processSendCustomEvent = (event: ProcessCustomEvent) => {
  outputConsole.debug(`发送进程自定义事件`, event);
  return new Promise<void>((resolve, reject) => {
    if (process.send) {
      process.send(event, (error: any) => {
        if (error) {
          outputConsole.error(`发送进程自定义事件失败`, error);
          reject(error);
        } else {
          outputConsole.debug(`发送进程自定义事件成功`, event);
          resolve();
        }
      });
    } else {
      outputConsole.error(
        `进程自定义事件发送失败，process.send is not defined`,
      );
      reject(new Error("process.send is not defined"));
    }
  });
};
