import { describe, it, expect } from "vitest";
import { selectProfile } from "@/handlers/profile";
import { PROFILE_PATH } from "@/utils/path";
import type { ProfileConfig } from "@/types";

const cfg: ProfileConfig = {
  defaultProfile: "deepseek",
  profiles: {
    deepseek: { env: { ANTHROPIC_MODEL: "x" } },
    empty: { env: {} },
  },
};

describe("selectProfile（REQ-4）", () => {
  it("指定存在的 profile → 返回该 profile", () => {
    const { name, profile } = selectProfile(cfg, "deepseek");
    expect(name).toBe("deepseek");
    expect(profile.env.ANTHROPIC_MODEL).toBe("x");
  });

  it("无 profileName → 用 defaultProfile", () => {
    const { name } = selectProfile(cfg);
    expect(name).toBe("deepseek");
  });

  it("空 env {} 合法，不报错", () => {
    const { profile } = selectProfile(cfg, "empty");
    expect(profile.env).toEqual({});
  });

  it("指定不存在的 profile → throw（含可用名 + 配置路径）", () => {
    try {
      selectProfile(cfg, "nope");
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("nope");
      expect(msg).toContain("deepseek");
      expect(msg).toContain(PROFILE_PATH);
    }
  });

  it("defaultProfile 悬空 → throw（含可用名 + 路径）", () => {
    const bad: ProfileConfig = {
      defaultProfile: "ghost",
      profiles: { real: { env: {} } },
    };
    expect(() => selectProfile(bad)).toThrowError(/ghost/);
    expect(() => selectProfile(bad)).toThrowError(/real/);
  });

  it("[MUST NOT] 猜最近名 / 回退 default", () => {
    expect(() => selectProfile(cfg, "deepsek")).toThrowError();
  });
});
