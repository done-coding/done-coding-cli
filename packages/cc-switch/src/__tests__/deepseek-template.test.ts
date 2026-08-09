import { describe, it, expect } from "vitest";
import { DEEPSEEK_SETTINGS_TEMPLATE, buildProfileConfig } from "@/utils/config";

describe("DEEPSEEK_SETTINGS_TEMPLATE（纯新装 starter，settings 源形态）", () => {
  it('defaultProfile === "deepseek-pro"', () => {
    expect(DEEPSEEK_SETTINGS_TEMPLATE.defaultProfile).toBe("deepseek-pro");
  });

  it("provider deepseek 内嵌 flash/pro 两模型", () => {
    const p = DEEPSEEK_SETTINGS_TEMPLATE.providers.deepseek;
    expect(p.name).toBe("DeepSeek");
    expect(p.url).toBe("https://api.deepseek.com/anthropic");
    expect(p.models.map((m) => m.id)).toEqual(["flash", "pro"]);
    expect(p.models.map((m) => m.name)).toEqual([
      "deepseek-v4-flash[1m]",
      "deepseek-v4-pro[1m]",
    ]);
  });

  it("ANTHROPIC_AUTH_TOKEN 落位：apiKey === ''（绝不含真实 token）", () => {
    expect(DEEPSEEK_SETTINGS_TEMPLATE.providers.deepseek.apiKey).toBe("");
  });

  it("provider envExtraParams 保留 CLAUDE_CODE_EFFORT_LEVEL=max", () => {
    expect(
      DEEPSEEK_SETTINGS_TEMPLATE.providers.deepseek.envExtraParams,
    ).toEqual({ CLAUDE_CODE_EFFORT_LEVEL: "max" });
  });

  it("编译后 env 键集合与 REQ-3 表逐键一致（pro 档）", () => {
    const cfg = buildProfileConfig(DEEPSEEK_SETTINGS_TEMPLATE);
    const env = cfg.profiles["deepseek-pro"].env;
    expect(Object.keys(env)).toEqual([
      "ANTHROPIC_BASE_URL",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "CLAUDE_CODE_SUBAGENT_MODEL",
      "CLAUDE_CODE_EFFORT_LEVEL",
    ]);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_MODEL).toBe("deepseek-v4-pro[1m]");
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("deepseek-v4-flash[1m]");
    expect(env.CLAUDE_CODE_EFFORT_LEVEL).toBe("max");
  });
});
