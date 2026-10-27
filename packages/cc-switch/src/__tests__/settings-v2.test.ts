import { describe, it, expect } from "vitest";
import {
  buildProfileConfig,
  parseSettings,
  normalizeSettings,
} from "@/utils/config";
import { assignMissingUuids } from "@/utils/settings-v2";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fixture = () => ({
  version: 2 as const,
  defaultProfile: { provider: id(1), account: id(3), model: id(4) },
  providers: [
    {
      uuid: id(1),
      alias: "ark-agent-plan",
      name: "方舟",
      url: "https://example.test",
      envExtraParams: { EFFORT: "max", ANTHROPIC_MODEL: "provider" },
      accounts: [
        { uuid: id(2), alias: "157", apiKey: "test-157" },
        { uuid: id(3), alias: "199", apiKey: "test-199" },
      ],
      models: [
        {
          uuid: id(4),
          alias: "glm",
          name: "glm[1m]",
          envExtraParams: { ANTHROPIC_MODEL: "model" },
        },
      ],
    },
  ],
});

describe("settings v2", () => {
  it("多账号生成独立凭据与 UUID 默认引用，env 仍按模型优先", () => {
    const cfg = buildProfileConfig(fixture());
    expect(Object.keys(cfg.profiles)).toEqual([
      "ark-agent-plan-157-glm",
      "ark-agent-plan-199-glm",
    ]);
    expect(cfg.defaultProfile).toBe("ark-agent-plan-199-glm");
    expect(
      cfg.profiles["ark-agent-plan-157-glm"].env.ANTHROPIC_AUTH_TOKEN,
    ).toBe("test-157");
    expect(
      cfg.profiles["ark-agent-plan-199-glm"].env.ANTHROPIC_AUTH_TOKEN,
    ).toBe("test-199");
    expect(cfg.profiles["ark-agent-plan-199-glm"].env.ANTHROPIC_MODEL).toBe(
      "model",
    );
    expect(cfg.profiles["ark-agent-plan-199-glm"].env.EFFORT).toBe("max");
  });
  it("改三层 alias 后默认引用随 UUID 保持", () => {
    const s = fixture();
    s.providers[0].alias = "renamed";
    s.providers[0].accounts[1].alias = "new";
    s.providers[0].models[0].alias = "m";
    expect(buildProfileConfig(s).defaultProfile).toBe("renamed-new-m");
  });
  it.each(["", "中文", " x", "a/b", "-a"])("拒绝非法 alias %s", (alias) => {
    const s = fixture();
    s.providers[0].alias = alias;
    expect(() => parseSettings(s)).toThrow(/alias/);
  });
  it.each(["providers", "accounts", "models"])(
    "%s 的同层 UUID / alias 唯一",
    (layer) => {
      for (const field of ["uuid", "alias"] as const) {
        const s = fixture();
        if (layer === "providers")
          s.providers.push({
            ...s.providers[0],
            uuid: id(9),
            alias: "other",
            [field]: s.providers[0][field],
          });
        if (layer === "accounts")
          s.providers[0].accounts[1][field] = s.providers[0].accounts[0][field];
        if (layer === "models")
          s.providers[0].models.push({
            ...s.providers[0].models[0],
            uuid: id(9),
            alias: "other",
            [field]: s.providers[0].models[0][field],
          });
        expect(() => parseSettings(s)).toThrow(/重复/);
      }
    },
  );
  it("全局拼名冲突列出两个不同来源", () => {
    const s = {
      version: 2,
      providers: [
        {
          uuid: id(1),
          alias: "a-b",
          name: "A",
          url: "u",
          apiKey: "",
          models: [{ uuid: id(2), alias: "c", name: "m" }],
        },
        {
          uuid: id(3),
          alias: "a",
          name: "B",
          url: "u",
          apiKey: "",
          models: [{ uuid: id(4), alias: "b-c", name: "m" }],
        },
      ],
    };
    expect(() => parseSettings(s)).toThrow(/a-b\/c.*a\/b-c/);
  });
  it.each(["provider", "account", "model"])("默认 %s 悬空即拒绝", (key) => {
    const s = fixture();
    s.defaultProfile[key] = id(99);
    expect(() => parseSettings(s)).toThrow(/默认 profile 悬空/);
  });
  it("多账号默认必须带所属 account", () => {
    const s = fixture();
    delete s.defaultProfile.account;
    expect(() => parseSettings(s)).toThrow(/默认 profile 悬空/);
  });
  it("apiKey/accounts 恰有其一，accounts 非空", () => {
    for (const credential of [
      { apiKey: "x" },
      { accounts: [] },
      { accounts: undefined },
    ]) {
      const s = fixture();
      Object.assign(s.providers[0], credential);
      expect(() => parseSettings(s)).toThrow(/apiKey|accounts/);
    }
  });
  it("读取缺 UUID 拒绝；补齐返回副本且已有 UUID 和扩展字段保留", () => {
    const s = fixture();
    delete s.providers[0].models[0].uuid;
    expect(() => parseSettings(s)).toThrow(/uuid/);
    const filled = assignMissingUuids({ ...s, extra: "keep" });
    expect(s.providers[0].models[0].uuid).toBeUndefined();
    expect(filled.providers[0].models[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(filled.providers[0].uuid).toBe(id(1));
    expect(filled).toHaveProperty("extra", "keep");
    expect(assignMissingUuids(filled)).toEqual(filled);
  });
  it("三类实体均补 UUID，非法既有 UUID 不掩盖", () => {
    const s = fixture();
    delete s.defaultProfile;
    delete s.providers[0].uuid;
    delete s.providers[0].accounts[0].uuid;
    delete s.providers[0].models[0].uuid;
    expect(() => parseSettings(assignMissingUuids(s))).not.toThrow();
    s.providers[0].uuid = "invalid";
    expect(() => parseSettings(assignMissingUuids(s))).toThrow(/uuid/);
  });
  it("拒绝不支持的版本和非法根", () => {
    for (const s of [
      null,
      [],
      { version: 3, providers: {} },
      { version: 1, providers: {} },
    ])
      expect(() => parseSettings(s)).toThrow();
  });
  it("归一化将账号展开，不静默覆盖展开 id 冲突", () => {
    expect(normalizeSettings(fixture()).map((p) => p.id)).toEqual([
      "ark-agent-plan-157",
      "ark-agent-plan-199",
    ]);
    const s = fixture();
    delete s.defaultProfile;
    s.providers.push({
      uuid: id(8),
      alias: "ark-agent",
      name: "B",
      url: "u",
      accounts: [{ uuid: id(9), alias: "plan-157", apiKey: "b" }],
      models: [{ uuid: id(10), alias: "other", name: "m" }],
    });
    expect(() => normalizeSettings(s)).toThrow(/冲突/);
  });
});
