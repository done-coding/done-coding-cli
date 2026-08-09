import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import {
  addModelEntry,
  modelListLines,
  normalizeModelName,
  providerListLines,
  setProviderApiKey,
} from "@/utils/config";
import { MODEL_PATH, PROVIDER_PATH } from "@/utils/path";
import { parseArgv } from "@/handlers/profile";
import { selectProvider } from "@/utils/meta";
import { resolveHandlerContext, xPrompts } from "@done-coding/cli-utils";
import type { ModelConfig, ProviderConfig } from "@/types";

vi.mock("@done-coding/cli-utils", () => ({
  resolveHandlerContext: vi.fn(),
  xPrompts: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveHandlerContext);
const mockedXPrompts = vi.mocked(xPrompts);

/** process.exit 抛错以中断流程，断言退出码。 */
class ExitSignal extends Error {
  public constructor(public code: number) {
    super(`exit:${code}`);
  }
}

const providerConfig: ProviderConfig = {
  providers: {
    deepseek: {
      name: "DeepSeek",
      url: "https://api.deepseek.com/anthropic",
      apiKey: "sk-test-deepseek",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
    },
    "ark-agent-plan": {
      name: "火山方舟 plan",
      url: "https://ark.cn-beijing.volces.com/api/plan",
      apiKey: "ark-test-plan",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
    },
  },
};

const modelConfig: ModelConfig = {
  defaultProfile: "ark-agent-plan-glm",
  models: [
    { provider: "deepseek", id: "flash", name: "deepseek-v4-flash[1m]" },
    {
      provider: "deepseek",
      id: "pro",
      name: "deepseek-v4-pro[1m]",
      envExtraParams: {
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
      },
    },
    { provider: "ark-agent-plan", id: "glm", name: "glm-5.2[1m]" },
  ],
};

/**
 * 全 mock fs：可变内存 store 模拟真实落盘（write 更新 store、read 回读 store），
 * 使 addModelEntry/setProviderApiKey 内 generateConfig 重载到的是更新后的源。
 */
const mockSourceFs = () => {
  const store = new Map<string, string>([
    [PROVIDER_PATH, JSON.stringify(providerConfig)],
    [MODEL_PATH, JSON.stringify(modelConfig)],
  ]);
  vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);
  vi.spyOn(fs, "chmodSync").mockImplementation((() => undefined) as never);
  const write = vi.spyOn(fs, "writeFileSync").mockImplementation((p, data) => {
    store.set(String(p), String(data));
  });
  vi.spyOn(fs, "existsSync").mockImplementation((p) => store.has(String(p)));
  vi.spyOn(fs, "readFileSync").mockImplementation(
    (p) => store.get(String(p)) ?? "",
  );
  return { write, store };
};

describe("normalizeModelName（id 去 [1m]、name 拼 [1m]、防双拼）", () => {
  it("无 [1m] → id=原样、name=+[1m]", () => {
    expect(normalizeModelName("glm-4.6")).toEqual({
      id: "glm-4.6",
      name: "glm-4.6[1m]",
    });
  });

  it("已带 [1m] → 防双拼（id 去 [1m]，name 只拼一次）", () => {
    expect(normalizeModelName("glm-4.6[1m]")).toEqual({
      id: "glm-4.6",
      name: "glm-4.6[1m]",
    });
  });

  it("空名 → throw", () => {
    expect(() => normalizeModelName("  ")).toThrowError(/为空/);
  });
});

describe("setProviderApiKey（改 key → 写源 → 自动重建）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("provider 存在 → 更新 apiKey、写 provider.json、重建 profile.json（env 落新 key）", () => {
    const { write } = mockSourceFs();
    const cfg = setProviderApiKey("deepseek", "sk-new-key");

    expect(cfg.profiles["deepseek-flash"].env.ANTHROPIC_AUTH_TOKEN).toBe(
      "sk-new-key",
    );
    const providerWrite = write.mock.calls.find((c) =>
      String(c[0]).endsWith("provider.json"),
    );
    expect(providerWrite).toBeDefined();
    expect(String(providerWrite![1])).toContain("sk-new-key");
    const profileWrite = write.mock.calls.find((c) =>
      String(c[0]).endsWith("profile.json"),
    );
    expect(profileWrite).toBeDefined();
    expect(String(profileWrite![1])).toContain("sk-new-key");
  });

  it("provider 不存在 → throw 列可用", () => {
    mockSourceFs();
    expect(() => setProviderApiKey("nope", "k")).toThrowError(/不存在/);
    expect(() => setProviderApiKey("nope", "k")).toThrowError(/deepseek/);
  });
});

describe("addModelEntry（加模型 → 写源 → 自动重建）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("新模型 → 追加 model.json、重建 profile.json（name=id+[1m]）", () => {
    const { write } = mockSourceFs();
    const cfg = addModelEntry("ark-agent-plan", "glm-4.6");

    expect(cfg.profiles["ark-agent-plan-glm-4.6"].env.ANTHROPIC_MODEL).toBe(
      "glm-4.6[1m]",
    );
    expect(Object.keys(cfg.profiles)).toContain("ark-agent-plan-glm-4.6");
    const modelWrite = write.mock.calls.find((c) =>
      String(c[0]).endsWith("model.json"),
    );
    expect(modelWrite).toBeDefined();
    expect(String(modelWrite![1])).toContain("glm-4.6");
    expect(String(modelWrite![1])).toContain("glm-4.6[1m]");
    const profileWrite = write.mock.calls.find((c) =>
      String(c[0]).endsWith("profile.json"),
    );
    expect(profileWrite).toBeDefined();
    expect(String(profileWrite![1])).toContain("ark-agent-plan-glm-4.6");
  });

  it("传入已带 [1m] → 防双拼", () => {
    mockSourceFs();
    const cfg = addModelEntry("ark-agent-plan", "glm-4.6[1m]");
    expect(cfg.profiles["ark-agent-plan-glm-4.6"].env.ANTHROPIC_MODEL).toBe(
      "glm-4.6[1m]",
    );
    expect(Object.keys(cfg.profiles).length).toBe(4);
  });

  it("(provider,id) 已存在 → throw", () => {
    mockSourceFs();
    expect(() => addModelEntry("ark-agent-plan", "glm")).toThrowError(/已存在/);
    expect(() => addModelEntry("ark-agent-plan", "glm[1m]")).toThrowError(
      /已存在/,
    );
  });

  it("provider 不存在 → throw", () => {
    mockSourceFs();
    expect(() => addModelEntry("nope", "x")).toThrowError(/不存在/);
  });
});

describe("parseArgv --meta-apiKey / --meta-model-name / --meta-provider", () => {
  it("识别 --meta-apiKey= → setkey，值入 apiKey，其余透传", () => {
    const r = parseArgv(["--meta-apiKey=sk-abc", "hi"]);
    expect(r.action).toBe("setkey");
    expect(r.apiKey).toBe("sk-abc");
    expect(r.passthrough).toEqual(["hi"]);
  });

  it("识别 --meta-model-name= → addmodel，值入 modelName", () => {
    const r = parseArgv(["--meta-model-name=glm-4.6"]);
    expect(r.action).toBe("addmodel");
    expect(r.modelName).toBe("glm-4.6");
  });

  it("--meta-provider= 是选择器：随 setkey/addmodel 用不报错", () => {
    const r = parseArgv(["--meta-apiKey=k", "--meta-provider=deepseek"]);
    expect(r.action).toBe("setkey");
    expect(r.providerId).toBe("deepseek");
    expect(
      parseArgv(["--meta-model-name=m", "--meta-provider=deepseek"]).providerId,
    ).toBe("deepseek");
  });

  it("--meta-provider 单独/配其它动作 → fail-fast", () => {
    expect(() => parseArgv(["--meta-provider=deepseek"])).toThrowError(
      /仅用于/,
    );
    expect(() =>
      parseArgv(["--meta-provider=deepseek", "--meta-pick"]),
    ).toThrowError(/仅用于/);
  });

  it("空值 → fail-fast", () => {
    expect(() => parseArgv(["--meta-apiKey="])).toThrowError(/需提供/);
    expect(() => parseArgv(["--meta-model-name="])).toThrowError(/需提供/);
    expect(() => parseArgv(["--meta-provider="])).toThrowError(/需提供/);
  });

  it("互斥：--meta-apiKey 与 --meta-model-name 同给 → fail-fast", () => {
    expect(() =>
      parseArgv(["--meta-apiKey=k", "--meta-model-name=m"]),
    ).toThrowError(/不能同时/);
  });

  it("互斥：与 --meta-generate 同给 → fail-fast", () => {
    expect(() =>
      parseArgv(["--meta-apiKey=k", "--meta-generate"]),
    ).toThrowError(/不能与/);
  });

  it("优先级：help/version 高于 setkey/addmodel，且不误伤", () => {
    expect(parseArgv(["--meta-apiKey=k", "--meta-help"]).action).toBe("help");
    expect(parseArgv(["--meta-model-name=m", "--meta-version"]).action).toBe(
      "version",
    );
    expect(parseArgv(["--meta-model-name=m", "--meta-pick"]).action).toBe(
      "addmodel",
    );
  });

  it("不再判未知；非 --meta-* 原样透传", () => {
    expect(() => parseArgv(["--meta-apiKey=k"])).not.toThrow();
    expect(parseArgv(["--meta-model-name=m", "prompt"]).passthrough).toEqual([
      "prompt",
    ]);
  });
});

describe("selectProvider（setkey/addmodel 的提供商选择）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("TTY 交互 → 返回选中 provider；choices 含 id+name", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new ExitSignal(1);
    }) as never);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    mockedResolve.mockReturnValue({ interactive: true } as never);
    mockedXPrompts.mockResolvedValue({ provider: "ark-agent-plan" } as never);

    await expect(selectProvider(providerConfig)).resolves.toBe(
      "ark-agent-plan",
    );
    expect(mockedXPrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "select",
        name: "provider",
        choices: expect.arrayContaining([
          { title: "deepseek（DeepSeek）", value: "deepseek" },
          { title: "ark-agent-plan（火山方舟 plan）", value: "ark-agent-plan" },
        ]),
      }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("非 TTY → stderr 提示改用 --meta-provider=<id> + exit(1)，不调 prompts", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new ExitSignal(code ?? 0);
    }) as never);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    mockedResolve.mockReturnValue({ interactive: false } as never);

    await expect(selectProvider(providerConfig)).rejects.toBeInstanceOf(
      ExitSignal,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("--meta-provider=<id>"),
    );
    expect(mockedXPrompts).not.toHaveBeenCalled();
  });

  it("provider.json 无提供商 → stderr 提示编辑 + exit(1)", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new ExitSignal(code ?? 0);
    }) as never);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    mockedResolve.mockReturnValue({ interactive: true } as never);

    await expect(selectProvider({ providers: {} })).rejects.toBeInstanceOf(
      ExitSignal,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockedXPrompts).not.toHaveBeenCalled();
  });
});

describe("providerListLines / modelListLines（只读格式化）", () => {
  it("provider 列表：id（name），绝不含 apiKey", () => {
    expect(providerListLines(providerConfig)).toEqual([
      "deepseek（DeepSeek）",
      "ark-agent-plan（火山方舟 plan）",
    ]);
  });

  it("model 列表：name（provider），同模型多 provider 各一行", () => {
    expect(modelListLines(modelConfig)).toEqual([
      "deepseek-v4-flash[1m]（deepseek）",
      "deepseek-v4-pro[1m]（deepseek）",
      "glm-5.2[1m]（ark-agent-plan）",
    ]);
  });
});

describe("parseArgv --meta-provider-list / --meta-model-list", () => {
  it("识别两个列表 flag → providerlist / modellist", () => {
    expect(parseArgv(["--meta-provider-list"]).action).toBe("providerlist");
    expect(parseArgv(["--meta-model-list"]).action).toBe("modellist");
  });

  it("优先级：列表 > pick；help/version 仍最高", () => {
    expect(parseArgv(["--meta-pick", "--meta-provider-list"]).action).toBe(
      "providerlist",
    );
    expect(parseArgv(["--meta-model-list", "--meta-help"]).action).toBe("help");
  });

  it("不再判未知", () => {
    expect(() => parseArgv(["--meta-provider-list"])).not.toThrow();
    expect(() => parseArgv(["--meta-model-list"])).not.toThrow();
  });

  it("列表与 --meta-provider 混用 → fail-fast（provider 仅用于 setkey/addmodel）", () => {
    expect(() =>
      parseArgv(["--meta-provider-list", "--meta-provider=deepseek"]),
    ).toThrowError(/仅用于/);
    expect(() =>
      parseArgv(["--meta-model-list", "--meta-provider=deepseek"]),
    ).toThrowError(/仅用于/);
  });
});
