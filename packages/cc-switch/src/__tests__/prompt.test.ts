import { describe, it, expect } from "vitest";
import { isSecretKey, maskValue, findEmptyKeys } from "@/utils/prompt";

describe("isSecretKey（REQ-5/6）", () => {
  it("TOKEN/KEY/SECRET 命中（大小写不敏感）", () => {
    expect(isSecretKey("ANTHROPIC_AUTH_TOKEN")).toBe(true);
    expect(isSecretKey("api_key")).toBe(true);
    expect(isSecretKey("MY_secret")).toBe(true);
    expect(isSecretKey("client_KEY")).toBe(true);
  });

  it("非敏感键不命中", () => {
    expect(isSecretKey("ANTHROPIC_BASE_URL")).toBe(false);
    expect(isSecretKey("ANTHROPIC_MODEL")).toBe(false);
  });
});

describe("maskValue（REQ-6）", () => {
  it("非空值遮蔽，不含任何明文片段", () => {
    const m = maskValue("sk-abcdef1234567890");
    expect(m).not.toContain("sk-");
    expect(m).not.toContain("abcdef");
    expect(m).toBe("******");
  });
  it("空字符串原样空", () => {
    expect(maskValue("")).toBe("");
  });
});

describe("findEmptyKeys（REQ-5）", () => {
  it("仅严格空字符串命中，按插入顺序", () => {
    const env = {
      A: "v",
      B: "",
      C: "REPLACE_ME",
      D: "",
    };
    expect(findEmptyKeys(env)).toEqual(["B", "D"]);
  });

  it('"REPLACE_ME" 等非空占位不算空', () => {
    expect(findEmptyKeys({ X: "REPLACE_ME" })).toEqual([]);
  });

  it("无空值键 → 空数组", () => {
    expect(findEmptyKeys({ A: "1", B: "2" })).toEqual([]);
  });
});
