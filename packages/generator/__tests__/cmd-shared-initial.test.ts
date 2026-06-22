/**
 * [H4b] collectInteractiveAnswers：交互 prompt 默认值用 initial（按累积 env 渲染、级联）。
 * mock xPrompts 捕获传入的 initial，验证 ${name}/前序答案被渲染进默认值。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchConfig, EnvContext } from "@/types";

const promptCalls: Array<{ name: string; initial?: string }> = [];
const promptReturns: Record<string, string> = {};

vi.mock("@done-coding/cli-utils", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    xPrompts: vi.fn(async (q: { name: string; initial?: string }) => {
      promptCalls.push({ name: q.name, initial: q.initial });
      // 用户直接回车采纳默认值（initial）
      const v = promptReturns[promptCalls.length - 1] ?? q.initial ?? "";
      return { value: v };
    }),
  };
});

let collectInteractiveAnswers: typeof import("@/handlers/shared").collectInteractiveAnswers;

beforeEach(async () => {
  promptCalls.length = 0;
  for (const k of Object.keys(promptReturns)) delete promptReturns[k];
  ({ collectInteractiveAnswers } = await import("@/handlers/shared"));
});

afterEach(() => {
  vi.clearAllMocks();
});

const baseEnv = (): EnvContext =>
  ({
    name: "MyWidget",
    nameKebab: "my-widget",
    rawName: "my-widget",
    $: "$",
    execDir: "/x",
    templateDir: "/t",
    _: {} as never,
  }) as EnvContext;

describe("[H4b] 交互 initial 默认值级联渲染", () => {
  it("initial 引用 ${name} → prompt 默认值渲染为 builtins", async () => {
    const config: BatchConfig = {
      instanceDir: "x",
      files: [],
      collectEnvDataForm: [{ name: "title", initial: "${name} 组件" }],
    };
    await collectInteractiveAnswers({
      config,
      supplied: {},
      baseEnv: baseEnv(),
      ctx: { interactive: true } as never,
    });
    expect(promptCalls).toHaveLength(1);
    expect(promptCalls[0].initial).toBe("MyWidget 组件");
  });

  it("后项 initial 引用前序答案（级联累积）", async () => {
    const config: BatchConfig = {
      instanceDir: "x",
      files: [],
      collectEnvDataForm: [
        { name: "prefix", initial: "Dc" },
        { name: "full", initial: "${prefix}${name}" },
      ],
    };
    promptReturns[0] = "My"; // 用户把 prefix 改成 "My"
    await collectInteractiveAnswers({
      config,
      supplied: {},
      baseEnv: baseEnv(),
      ctx: { interactive: true } as never,
    });
    expect(promptCalls[0].initial).toBe("Dc");
    // 第二问的默认值用前序答案 "My" + builtins name
    expect(promptCalls[1].initial).toBe("MyMyWidget");
  });

  it("纯字符串 initial 原样作默认值（不渲染）", async () => {
    const config: BatchConfig = {
      instanceDir: "x",
      files: [],
      collectEnvDataForm: [{ name: "plain", initial: "hello" }],
    };
    await collectInteractiveAnswers({
      config,
      supplied: {},
      baseEnv: baseEnv(),
      ctx: { interactive: true } as never,
    });
    expect(promptCalls[0].initial).toBe("hello");
  });
});
