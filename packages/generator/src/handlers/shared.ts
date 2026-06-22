/**
 * [T5] 命令面共享：问题清单探针 + 交互供答补齐。
 *
 * content-free：仅消费 BatchConfig.collectEnvDataForm（generator 冻结契约形态），
 * [MUST NOT] 写死任何业务字段名。
 */
import type { BatchConfig, CollectFormItem, EnvContext } from "@/types";
import {
  outputConsole,
  updateEnvConfig,
  xPrompts,
  type HandlerContext,
} from "@done-coding/cli-utils";
import _template from "lodash.template";

/** 问题清单单项（探针 / MCP 复用，design §7：复刻 create --list-questions 形态） */
export interface BatchQuestion {
  /** 变量名（采集结果挂到 env 此键） */
  key: string;
  /** 是否必填（无 initial 默认值即视为必填） */
  required: boolean;
  /** 默认值（initial，可为引用前序答案的 `${}` 模板字符串） */
  default?: unknown;
}

/** 归一化 collectEnvDataForm 为统一表单项（字符串简写 → { name }） */
const normalizeForm = (
  form: BatchConfig["collectEnvDataForm"] = [],
): CollectFormItem[] => {
  return form.map((item) => (typeof item === "string" ? { name: item } : item));
};

/**
 * 构造批次问题清单（**纯函数，无 stdout**，design §2/§12 B6）。
 * 供 P3 MCP `list_questions` 工具复用（[MUST NOT] 让 MCP 走 listBatchQuestions 的 stdout 路径）。
 */
export const buildBatchQuestions = (config: BatchConfig): BatchQuestion[] =>
  normalizeForm(config.collectEnvDataForm).map((item) => ({
    key: item.name,
    required: item.initial === undefined,
    ...(item.initial !== undefined ? { default: item.initial } : {}),
  }));

/**
 * `--list-questions` 探针：返回该批次问题清单（不落地，Ⓔ）。
 * 静默装饰性日志，stdout 仅输出纯 JSON（复刻 create listTemplateQuestions）。
 * B6：行为逐字节不变——仅数组构造委托 buildBatchQuestions，updateEnvConfig 时机/JSON 格式/尾换行不动。
 */
export const listBatchQuestions = (config: BatchConfig): BatchQuestion[] => {
  const questions: BatchQuestion[] = buildBatchQuestions(config);

  updateEnvConfig({ consoleLog: false });
  process.stdout.write(`${JSON.stringify(questions, null, 2)}\n`);
  return questions;
};

/**
 * H4b：渲染 initial 默认值（仅渲含 `${` 的字符串，按累积 env 级联）。
 * 复刻 batch-compile 的 initial 级联：纯字符串原样、引用不存在变量 fail-fast。
 */
const renderInitial = (
  initial: unknown,
  env: Record<string, unknown>,
  questionKey: string,
): string | undefined => {
  if (typeof initial !== "string" || !initial.includes("${")) {
    return typeof initial === "string" ? initial : undefined;
  }
  try {
    return _template(initial)(env);
  } catch (error) {
    throw new Error(
      `模板参数「${questionKey}」的 initial 默认值 ${JSON.stringify(
        initial,
      )} 引用了不存在的变量：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/**
 * 交互补齐：对 collectEnvDataForm 中**未被非交互供答覆盖**的项逐个询问。
 * - interactive 模式：缺项走 xPrompts 询问；默认值用 initial（按累积 env 渲染，H4b 级联）。
 * - 非交互模式（mcp/test）：不询问；缺项不在此 fail（缺必填由级联 / operate 渲染期 fail-fast 兜底，design §4.2）。
 *
 * 返回**仅本函数新采集到的答案**（不含 supplied，供调用方与 supplied 合并）。
 */
export const collectInteractiveAnswers = async ({
  config,
  supplied,
  baseEnv,
  ctx,
}: {
  config: BatchConfig;
  supplied: Record<string, unknown>;
  /** 级联底座（含内建 canonical/helper），H4b initial 渲染上下文起点 */
  baseEnv?: EnvContext;
  ctx: HandlerContext;
}): Promise<Record<string, unknown>> => {
  const collected: Record<string, unknown> = { ...supplied };
  if (!ctx.interactive) {
    return supplied;
  }
  // 级联渲染上下文：内建底座 + 已供答，随循环累积（后项 initial 可引用前序答案）
  const renderCtx: Record<string, unknown> = { ...baseEnv, ...supplied };
  const answers: Record<string, unknown> = {};
  for (const item of normalizeForm(config.collectEnvDataForm)) {
    if (collected[item.name] !== undefined) {
      continue;
    }
    const { value } = await xPrompts({
      type: "text",
      name: "value",
      message: item.message ?? `请输入 ${item.name}`,
      initial: renderInitial(item.initial, renderCtx, item.name),
    });
    if (value !== undefined) {
      answers[item.name] = value;
      collected[item.name] = value;
      renderCtx[item.name] = value;
    }
  }
  if (Object.keys(answers).length) {
    outputConsole.info(`已采集 ${Object.keys(answers).length} 个参数`);
  }
  return answers;
};
