import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import {
  buildProfileConfig,
  composeEnv,
  generateConfig,
  loadModelConfig,
  loadOrInitConfig,
  loadProviderConfig,
} from "@/utils/config";
import { MODEL_PATH, PROFILE_PATH, PROVIDER_PATH } from "@/utils/path";
import { parseArgv } from "@/handlers/profile";
import type { ModelConfig, ProviderConfig } from "@/types";

/** 夹具：占位密钥（不入真实 token），结构镜像当前 10 个 profile 的因子拆解。 */
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
    "ark-coding-plan": {
      name: "火山方舟 coding",
      url: "https://ark.cn-beijing.volces.com/api/coding",
      apiKey: "ark-test-coding",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
    },
  },
};

const modelConfig: ModelConfig = {
  defaultProfile: "ark-agent-plan-deepseek-flash",
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
    {
      provider: "ark-agent-plan",
      id: "deepseek-flash",
      name: "deepseek-v4-flash[1m]",
    },
    {
      provider: "ark-agent-plan",
      id: "deepseek-pro",
      name: "deepseek-v4-pro[1m]",
      envExtraParams: {
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
      },
    },
    { provider: "ark-agent-plan", id: "glm", name: "glm-5.2[1m]" },
    { provider: "ark-agent-plan", id: "kimi-k3", name: "kimi-k3[1m]" },
    { provider: "ark-agent-plan", id: "kimi-k2.7", name: "kimi-k2.7[1m]" },
    {
      provider: "ark-coding-plan",
      id: "deepseek-flash",
      name: "deepseek-v4-flash[1m]",
    },
    {
      provider: "ark-coding-plan",
      id: "deepseek-pro",
      name: "deepseek-v4-pro[1m]",
      envExtraParams: {
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
      },
    },
    {
      provider: "ark-coding-plan",
      id: "glm",
      name: "glm-5.2[1m]",
    },
  ],
};

const expectedProfileNames = [
  "deepseek-flash",
  "deepseek-pro",
  "ark-agent-plan-deepseek-flash",
  "ark-agent-plan-deepseek-pro",
  "ark-agent-plan-glm",
  "ark-agent-plan-kimi-k3",
  "ark-agent-plan-kimi-k2.7",
  "ark-coding-plan-deepseek-flash",
  "ark-coding-plan-deepseek-pro",
  "ark-coding-plan-glm",
];

describe("composeEnv（{...通用, ...providerExtra, ...modelExtra}）", () => {
  it("通用由 provider.url/apiKey + model.name 推导，四档默认镜像 model.name", () => {
    const env = composeEnv(providerConfig.providers.deepseek, {
      provider: "deepseek",
      id: "flash",
      name: "deepseek-v4-flash[1m]",
    });
    expect(env).toEqual({
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      ANTHROPIC_AUTH_TOKEN: "sk-test-deepseek",
      ANTHROPIC_MODEL: "deepseek-v4-flash[1m]",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-flash[1m]",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-flash[1m]",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
      CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-flash[1m]",
      CLAUDE_CODE_EFFORT_LEVEL: "max",
    });
  });

  it("合并序：model 覆盖 provider，provider 覆盖通用", () => {
    const env = composeEnv(
      {
        name: "X",
        url: "https://u",
        apiKey: "k",
        envExtraParams: {
          CLAUDE_CODE_EFFORT_LEVEL: "medium",
          ANTHROPIC_MODEL: "provider-override",
        },
      },
      {
        provider: "X",
        id: "m",
        name: "real-model",
        envExtraParams: { ANTHROPIC_MODEL: "model-wins" },
      },
    );
    expect(env.ANTHROPIC_MODEL).toBe("model-wins");
    expect(env.CLAUDE_CODE_EFFORT_LEVEL).toBe("medium");
  });
});

describe("buildProfileConfig（迁移等价 + 校验）", () => {
  it("夹具 → 10 个 profile，命名/顺序/默认与当前配置逐键一致", () => {
    const cfg = buildProfileConfig(providerConfig, modelConfig);
    expect(Object.keys(cfg.profiles)).toEqual(expectedProfileNames);
    expect(cfg.defaultProfile).toBe("ark-agent-plan-deepseek-flash");

    const dsFlash = cfg.profiles["deepseek-flash"].env;
    expect(dsFlash.ANTHROPIC_BASE_URL).toBe(
      "https://api.deepseek.com/anthropic",
    );
    expect(dsFlash.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-deepseek");
    expect(dsFlash.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("deepseek-v4-flash[1m]");
    expect(dsFlash.CLAUDE_CODE_EFFORT_LEVEL).toBe("max");

    // pro 档 haiku 走 model.envExtraParams 覆盖
    expect(cfg.profiles["deepseek-pro"].env.ANTHROPIC_MODEL).toBe(
      "deepseek-v4-pro[1m]",
    );
    expect(cfg.profiles["deepseek-pro"].env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(
      "deepseek-v4-flash[1m]",
    );
    expect(cfg.profiles["deepseek-pro"].env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe(
      "deepseek-v4-pro[1m]",
    );

    // 同模型不同服务商：url/apiKey 各自独立
    expect(cfg.profiles["ark-agent-plan-glm"].env.ANTHROPIC_AUTH_TOKEN).toBe(
      "ark-test-plan",
    );
    expect(cfg.profiles["ark-agent-plan-glm"].env.ANTHROPIC_MODEL).toBe(
      "glm-5.2[1m]",
    );
    expect(
      cfg.profiles["ark-coding-plan-deepseek-flash"].env.ANTHROPIC_AUTH_TOKEN,
    ).toBe("ark-test-coding");
  });

  it("model 引用不存在的 provider → throw", () => {
    expect(() =>
      buildProfileConfig(providerConfig, {
        defaultProfile: "x",
        models: [{ provider: "nope", id: "m", name: "m" }],
      }),
    ).toThrowError(/不存在的 provider/);
  });

  it("provider+id 组合重复 → throw", () => {
    const mc = {
      defaultProfile: "a-m",
      models: [
        { provider: "deepseek", id: "m", name: "m1" },
        { provider: "deepseek", id: "m", name: "m2" },
      ],
    };
    expect(() => buildProfileConfig(providerConfig, mc)).toThrowError(/重复/);
  });

  it("models 为空 → throw", () => {
    expect(() =>
      buildProfileConfig(providerConfig, {
        defaultProfile: "x",
        models: [],
      }),
    ).toThrowError(/为空/);
  });

  it("defaultProfile 悬空 → throw（列出可用）", () => {
    const mc = {
      defaultProfile: "nope",
      models: [{ provider: "deepseek", id: "flash", name: "f" }],
    };
    expect(() => buildProfileConfig(providerConfig, mc)).toThrowError(
      /不在生成的 profile 中/,
    );
    expect(() => buildProfileConfig(providerConfig, mc)).toThrowError(
      /deepseek-flash/,
    );
  });
});

describe("loadProviderConfig / loadModelConfig（fail-loud）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("provider.json 缺失 → throw 带路径", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(() => loadProviderConfig()).toThrowError(PROVIDER_PATH);
  });

  it("provider.json 非法 JSON → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ bad" as never);
    expect(() => loadProviderConfig()).toThrowError(/非法 JSON/);
  });

  it("provider 缺 url → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: { deepseek: { name: "x", apiKey: "k" } },
      }) as never,
    );
    expect(() => loadProviderConfig()).toThrowError(/缺字符串字段 url/);
  });

  it("model.json 缺失 → throw 带路径", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(() => loadModelConfig()).toThrowError(MODEL_PATH);
  });

  it("model 缺 provider 字段 → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        defaultProfile: "x",
        models: [{ id: "m", name: "m" }],
      }) as never,
    );
    expect(() => loadModelConfig()).toThrowError(/缺字符串字段 provider/);
  });

  it("合法源 → 解析返回", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("provider.json"))
        return JSON.stringify(providerConfig) as never;
      if (s.endsWith("model.json")) return JSON.stringify(modelConfig) as never;
      return "" as never;
    });
    expect(loadProviderConfig()).toEqual(providerConfig);
    expect(loadModelConfig()).toEqual(modelConfig);
  });
});

describe("loadOrInitConfig 缺失行为（提示不自动生成）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("profile.json 缺失但已有源 → throw 提示 --meta-generate，不写模板", () => {
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "existsSync").mockImplementation((p) =>
      String(p).endsWith("provider.json"),
    );
    expect(() => loadOrInitConfig()).toThrowError(/--meta-generate/);
    expect(write).not.toHaveBeenCalled();
  });

  it("profile.json 缺失且无任何源 → 写模板兜底", () => {
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const cfg = loadOrInitConfig();
    expect(cfg.profiles.deepseek).toBeDefined();
    expect(write).toHaveBeenCalled();
    expect(chmod).toHaveBeenCalledWith(PROFILE_PATH, 0o600);
  });
});

describe("generateConfig（端到端，全 mock fs）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("读源 → 构建 → 写 profile.json → 返回 10 profile", () => {
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      const s = String(p);
      return s.endsWith("provider.json") || s.endsWith("model.json");
    });
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("provider.json"))
        return JSON.stringify(providerConfig) as never;
      if (s.endsWith("model.json")) return JSON.stringify(modelConfig) as never;
      return "" as never;
    });

    const cfg = generateConfig();
    expect(Object.keys(cfg.profiles)).toEqual(expectedProfileNames);
    expect(write).toHaveBeenCalledWith(
      PROFILE_PATH,
      JSON.stringify(cfg, null, 2),
    );
    expect(chmod).toHaveBeenCalledWith(PROFILE_PATH, 0o600);
  });
});

describe("parseArgv --meta-generate", () => {
  it("识别 --meta-generate → generate 动作，其余原样透传", () => {
    const r = parseArgv(["--meta-generate", "prompt"]);
    expect(r.action).toBe("generate");
    expect(r.passthrough).toEqual(["prompt"]);
  });

  it("优先级：generate > pick > profile；help/version > generate", () => {
    expect(parseArgv(["--meta-pick", "--meta-generate"]).action).toBe(
      "generate",
    );
    expect(parseArgv(["--meta-profile=x", "--meta-generate"]).action).toBe(
      "generate",
    );
    expect(parseArgv(["--meta-generate", "--meta-help"]).action).toBe("help");
    expect(parseArgv(["--meta-generate", "--meta-version"]).action).toBe(
      "version",
    );
  });

  it("--meta-generate 不再是未知 meta 选项", () => {
    expect(() => parseArgv(["--meta-generate"])).not.toThrow();
  });
});
