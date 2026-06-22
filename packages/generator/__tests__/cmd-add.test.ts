/**
 * [T5] add 命令面用例（design §4.1/§4.2/§7/§12-Ⓔ，NFR-1 P1 契约）。
 *
 * 隔离策略：T4 core（discoverBatch/createEnvContext/operate）并发未完，
 * 本用例 vi.mock 这些 core 模块，专测命令面契约（探针 / 非交互 fail-fast / 供答合并 / operate 派发）。
 * core 集成（真实落地）由 T8 兜底。
 */
/* eslint-disable no-template-curly-in-string */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchConfig, GeneratorHandler, ResolvedBatch } from "@/types";

const fakeConfig: BatchConfig = {
  instanceDir: "${execDir}/src/widget/${nameKebab}",
  list: { mode: "subdir" },
  collectEnvDataForm: [
    { name: "desc", message: "请输入描述" },
    { name: "owner", message: "请输入负责人", initial: "anon" },
  ],
  files: [{ input: "${templateDir}/template/x.md", output: "./src/x.ts" }],
};

const fakeBatch: ResolvedBatch = {
  type: "widget",
  hit: {
    segment: "widget",
    dir: "/abs/.done-coding/widget",
    namespaceDir: "/abs/.done-coding",
    realDir: "/abs/.done-coding/widget",
    layer: "project",
    shadowed: false,
  },
  config: fakeConfig,
};

const operateSpy = vi.fn(async () => {});
const discoverSpy = vi.fn(() => fakeBatch);

vi.mock("@/core/batch-discovery", () => ({
  discoverBatch: (...args: unknown[]) => discoverSpy(...(args as [])),
  listDiscoveredBatches: vi.fn(() => []),
  readBatchConfig: vi.fn(),
}));
vi.mock("@/core/env-context", () => ({
  createEnvContext: (rawName: string, opts: Record<string, unknown>) => ({
    name: rawName,
    nameKebab: rawName,
    rawName,
    $: "$",
    _: {},
    ...opts,
  }),
  createEnvHelpers: vi.fn(() => ({})),
}));
vi.mock("@/core/operate", () => ({
  operate: (...args: unknown[]) => operateSpy(...(args as [])),
}));
vi.mock("@/utils/ensure-name", () => ({
  ensureNameLegal: vi.fn(() => true),
  NAME_LEGAL_PATTERN: /^[a-zA-Z]+[a-zA-Z0-9-]*$/,
}));

let addHandler: GeneratorHandler;
let writeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  operateSpy.mockClear();
  discoverSpy.mockClear();
  writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  ({ handler: addHandler } = await import("@/handlers/add"));
});

afterEach(() => {
  writeSpy.mockRestore();
});

describe("[T5] dc-gen add", () => {
  it("--list-questions 探针：打印问题清单 JSON，不调 operate（Ⓔ）", async () => {
    await addHandler(
      { type: "widget", listQuestions: true },
      { mode: "test", cwd: "/abs" },
    );
    expect(operateSpy).not.toHaveBeenCalled();
    const printed = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(printed);
    expect(parsed).toEqual([
      { key: "desc", required: true },
      { key: "owner", required: false, default: "anon" },
    ]);
  });

  it("非交互 + --env 供答：合并进 env 后派 operate(add)", async () => {
    await addHandler(
      { type: "widget", name: "my-widget", env: '{"desc":"hello"}' },
      { mode: "test", cwd: "/abs", interactive: false },
    );
    expect(operateSpy).toHaveBeenCalledTimes(1);
    const opts = operateSpy.mock.calls[0][0] as {
      action: string;
      env: Record<string, unknown>;
    };
    expect(opts.action).toBe("add");
    expect(opts.env.desc).toBe("hello");
    expect(opts.env.name).toBe("my-widget");
  });

  it("缺 name → fail-fast（非交互契约）", async () => {
    await expect(
      addHandler({ type: "widget" }, { mode: "test", cwd: "/abs" }),
    ).rejects.toThrow(/name/);
    expect(operateSpy).not.toHaveBeenCalled();
  });

  it("缺 type → fail-fast", async () => {
    await expect(
      addHandler({ name: "x" }, { mode: "test", cwd: "/abs" }),
    ).rejects.toThrow(/type/);
  });

  it("--list-questions 缺 type → fail-fast", async () => {
    await expect(
      addHandler({ listQuestions: true }, { mode: "test", cwd: "/abs" }),
    ).rejects.toThrow(/批次类型/);
  });
});
