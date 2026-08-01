import { describe, it, expect } from "vitest";
import { DEEPSEEK_TEMPLATE } from "@/utils/config";

describe("DEEPSEEK_TEMPLATE（REQ-3）", () => {
  it('defaultProfile === "deepseek"', () => {
    expect(DEEPSEEK_TEMPLATE.defaultProfile).toBe("deepseek");
  });

  it("env 键集合与 REQ-3 表逐键一致", () => {
    expect(Object.keys(DEEPSEEK_TEMPLATE.profiles.deepseek.env)).toEqual([
      "ANTHROPIC_BASE_URL",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "CLAUDE_CODE_SUBAGENT_MODEL",
      "CLAUDE_CODE_EFFORT_LEVEL",
    ]);
  });

  it("ANTHROPIC_AUTH_TOKEN === ''（绝不含真实 token）", () => {
    expect(DEEPSEEK_TEMPLATE.profiles.deepseek.env.ANTHROPIC_AUTH_TOKEN).toBe(
      "",
    );
  });

  it("非敏感值逐字照表", () => {
    const env = DEEPSEEK_TEMPLATE.profiles.deepseek.env;
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
    expect(env.ANTHROPIC_MODEL).toBe("deepseek-v4-pro[1m]");
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("deepseek-v4-flash[1m]");
    expect(env.CLAUDE_CODE_EFFORT_LEVEL).toBe("max");
  });
});
