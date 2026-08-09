import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import {
  buildProfileConfig,
  composeEnv,
  generateConfig,
  loadSettings,
} from "@/utils/config";
import { PROFILE_PATH, SETTINGS_PATH } from "@/utils/path";
import { parseArgv } from "@/handlers/profile";
import type { Settings } from "@/types";

/** 夹具：占位密钥（不入真实 token），结构镜像当前 10 个 profile 的因子拆解。 */
const settingsConfig: Settings = {
  defaultProfile: "ark-agent-plan-deepseek-flash",
  providers: {
    deepseek: {
      name: "DeepSeek",
      url: "https://api.deepseek.com/anthropic",
      apiKey: "sk-test-deepseek",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
      models: [
        { id: "flash", name: "deepseek-v4-flash[1m]" },
        {
          id: "pro",
          name: "deepseek-v4-pro[1m]",
          envExtraParams: {
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
          },
        },
      ],
    },
    "ark-agent-plan": {
      name: "火山方舟 plan",
      url: "https://ark.cn-beijing.volces.com/api/plan",
      apiKey: "ark-test-plan",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
      models: [
        { id: "deepseek-flash", name: "deepseek-v4-flash[1m]" },
        {
          id: "deepseek-pro",
          name: "deepseek-v4-pro[1m]",
          envExtraParams: {
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
          },
        },
        { id: "glm", name: "glm-5.2[1m]" },
        { id: "kimi-k3", name: "kimi-k3[1m]" },
        { id: "kimi-k2.7", name: "kimi-k2.7[1m]" },
      ],
    },
    "ark-coding-plan": {
      name: "火山方舟 coding",
      url: "https://ark.cn-beijing.volces.com/api/coding",
      apiKey: "ark-test-coding",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
      models: [
        { id: "deepseek-flash", name: "deepseek-v4-flash[1m]" },
        {
          id: "deepseek-pro",
          name: "deepseek-v4-pro[1m]",
          envExtraParams: {
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
          },
        },
        { id: "glm", name: "glm-5.2[1m]" },
      ],
    },
  },
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
    const env = composeEnv(settingsConfig.providers.deepseek, {
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
        models: [],
      },
      {
        id: "m",
        name: "real-model",
        envExtraParams: { ANTHROPIC_MODEL: "model-wins" },
      },
    );
    expect(env.ANTHROPIC_MODEL).toBe("model-wins");
    expect(env.CLAUDE_CODE_EFFORT_LEVEL).toBe("medium");
  });
});

describe("buildProfileConfig（settings 单源构建 + 校验）", () => {
  it("夹具 → 10 个 profile，命名/顺序/默认与当前配置逐键一致", () => {
    const cfg = buildProfileConfig(settingsConfig);
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

  it("无可生成 profile（models 全空）→ throw", () => {
    expect(() =>
      buildProfileConfig({
        providers: {
          deepseek: {
            name: "DeepSeek",
            url: "https://u",
            apiKey: "k",
            models: [],
          },
        },
      }),
    ).toThrowError(/无可生成 profile/);
  });

  it("同 provider 下 model id 重复 → throw", () => {
    expect(() =>
      buildProfileConfig({
        providers: {
          deepseek: {
            name: "DeepSeek",
            url: "https://u",
            apiKey: "k",
            models: [
              { id: "m", name: "m1" },
              { id: "m", name: "m2" },
            ],
          },
        },
      }),
    ).toThrowError(/重复/);
  });

  it("defaultProfile 悬空 → throw（列出可用）", () => {
    expect(() =>
      buildProfileConfig({
        defaultProfile: "nope",
        providers: {
          deepseek: {
            name: "DeepSeek",
            url: "https://u",
            apiKey: "k",
            models: [{ id: "flash", name: "f" }],
          },
        },
      }),
    ).toThrowError(/不在生成的 profile 中/);
    expect(() =>
      buildProfileConfig({
        defaultProfile: "nope",
        providers: {
          deepseek: {
            name: "DeepSeek",
            url: "https://u",
            apiKey: "k",
            models: [{ id: "flash", name: "f" }],
          },
        },
      }),
    ).toThrowError(/deepseek-flash/);
  });

  it("defaultProfile 省略 → 合法，结果无 defaultProfile（可选语义）", () => {
    const cfg = buildProfileConfig({
      providers: {
        deepseek: {
          name: "DeepSeek",
          url: "https://u",
          apiKey: "k",
          models: [{ id: "flash", name: "f" }],
        },
      },
    });
    expect(cfg.defaultProfile).toBeUndefined();
    expect(Object.keys(cfg.profiles)).toEqual(["deepseek-flash"]);
  });

  it("disabledDefault / output 编译透传", () => {
    const cfg = buildProfileConfig({
      defaultProfile: "deepseek-flash",
      disabledDefault: true,
      output: { profileName: false },
      providers: {
        deepseek: {
          name: "DeepSeek",
          url: "https://u",
          apiKey: "k",
          models: [{ id: "flash", name: "f" }],
        },
      },
    });
    expect(cfg.disabledDefault).toBe(true);
    expect(cfg.output).toEqual({ profileName: false });
  });
});

describe("loadSettings（唯一源，fail-loud）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("settings.json 缺失 → throw 带路径", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(() => loadSettings()).toThrowError(SETTINGS_PATH);
  });

  it("非法 JSON → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ bad" as never);
    expect(() => loadSettings()).toThrowError(/非法 JSON/);
  });

  it("provider 缺 url → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: { deepseek: { name: "x", apiKey: "k", models: [] } },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/缺字符串字段 url/);
  });

  it("provider models 缺失 / 为空 → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: { deepseek: { name: "x", url: "u", apiKey: "k" } },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/models/);

    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: {
          deepseek: { name: "x", url: "u", apiKey: "k", models: [] },
        },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/models 为空/);
  });

  it("apiKey 为空字符串 → 合法（starter 语义，启动时补全）", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: {
          deepseek: {
            name: "x",
            url: "u",
            apiKey: "",
            models: [{ id: "m", name: "m" }],
          },
        },
      }) as never,
    );
    const s = loadSettings();
    expect(s.providers.deepseek.apiKey).toBe("");
  });

  it("apiKey 缺失 → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: {
          deepseek: {
            name: "x",
            url: "u",
            models: [{ id: "m", name: "m" }],
          },
        },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/apiKey/);
  });

  it("model 缺 name → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: {
          deepseek: {
            name: "x",
            url: "u",
            apiKey: "k",
            models: [{ id: "m" }],
          },
        },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/缺字符串字段 name/);
  });

  it("defaultProfile 非字符串 / disabledDefault / output.profileName 非布尔 → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        defaultProfile: 42,
        providers: {
          deepseek: { name: "x", url: "u", apiKey: "k", models: [{ id: "m", name: "m" }] },
        },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/defaultProfile/);

    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        disabledDefault: "yes",
        providers: {
          deepseek: { name: "x", url: "u", apiKey: "k", models: [{ id: "m", name: "m" }] },
        },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/disabledDefault/);

    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        output: { profileName: "yes" },
        providers: {
          deepseek: { name: "x", url: "u", apiKey: "k", models: [{ id: "m", name: "m" }] },
        },
      }) as never,
    );
    expect(() => loadSettings()).toThrowError(/profileName/);
  });

  it("合法源 → 解析返回（行为字段透传，空 envExtraParams 省略）", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(settingsConfig) as never,
    );
    expect(loadSettings()).toEqual(settingsConfig);
  });

  it("缺省行为字段 → 省略（无默认 / disabledDefault=false / 无 output）", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        providers: {
          deepseek: {
            name: "x",
            url: "u",
            apiKey: "k",
            models: [{ id: "m", name: "m" }],
          },
        },
      }) as never,
    );
    const s = loadSettings();
    expect(s.defaultProfile).toBeUndefined();
    expect(s.disabledDefault).toBeUndefined();
    expect(s.output).toBeUndefined();
  });
});

describe("generateConfig（端到端，全 mock fs）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("读 settings 源 → 构建 → 写 profile.json → 返回 10 profile", () => {
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "existsSync").mockImplementation((p) =>
      String(p).endsWith("settings.json"),
    );
    vi.spyOn(fs, "readFileSync").mockImplementation(
      () => JSON.stringify(settingsConfig) as never,
    );

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
