import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isModelEnvKey,
  buildChildEnv,
  hasModelEnvConflict,
  readSettingsEnv,
  MODEL_ENV_WHITELIST,
} from "@/utils/env-guard";

describe("isModelEnvKey（REQ-7 判定常量单一来源）", () => {
  it("所有 ANTHROPIC_ 前缀命中", () => {
    expect(isModelEnvKey("ANTHROPIC_BASE_URL")).toBe(true);
    expect(isModelEnvKey("ANTHROPIC_AUTH_TOKEN")).toBe(true);
    expect(isModelEnvKey("ANTHROPIC_FOO")).toBe(true);
  });

  it("白名单精确两键命中", () => {
    expect(isModelEnvKey("CLAUDE_CODE_SUBAGENT_MODEL")).toBe(true);
    expect(isModelEnvKey("CLAUDE_CODE_EFFORT_LEVEL")).toBe(true);
    expect(MODEL_ENV_WHITELIST.length).toBe(2);
  });

  it("非模型 CLAUDE_CODE_* 不命中（白名单精确等值，非前缀全删）", () => {
    expect(isModelEnvKey("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC")).toBe(
      false,
    );
    expect(isModelEnvKey("CLAUDE_CODE_SUBAGENT_MODEL_X")).toBe(false);
  });

  it("PATH/HOME/其他一律不命中", () => {
    expect(isModelEnvKey("PATH")).toBe(false);
    expect(isModelEnvKey("HOME")).toBe(false);
  });
});

describe("buildChildEnv（REQ-7 层 1 strip-then-inject）", () => {
  it("继承的 ANTHROPIC_* 被 strip，profile 未设则子进程不存在", () => {
    const r = buildChildEnv(
      { ANTHROPIC_BASE_URL: "inherited", PATH: "/bin" },
      {},
    );
    expect(r.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(r.PATH).toBe("/bin");
  });

  it("strip 继承再注入 profile，profile 值生效", () => {
    const r = buildChildEnv(
      { CLAUDE_CODE_EFFORT_LEVEL: "low", PATH: "/bin" },
      { CLAUDE_CODE_EFFORT_LEVEL: "max" },
    );
    expect(r.CLAUDE_CODE_EFFORT_LEVEL).toBe("max");
  });

  it("空 profile.env {} → 仍 strip 继承的所有模型 key（不回退继承）", () => {
    const r = buildChildEnv(
      {
        ANTHROPIC_MODEL: "x",
        CLAUDE_CODE_SUBAGENT_MODEL: "y",
        HOME: "/h",
      },
      {},
    );
    expect(r.ANTHROPIC_MODEL).toBeUndefined();
    expect(r.CLAUDE_CODE_SUBAGENT_MODEL).toBeUndefined();
    expect(r.HOME).toBe("/h");
  });

  it("非模型 CLAUDE_CODE_*（白名单外）原样保留", () => {
    const r = buildChildEnv(
      { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
      {},
    );
    expect(r.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
  });

  it("[MUST NOT] 修改传入的 process.env 对象", () => {
    const src: NodeJS.ProcessEnv = { ANTHROPIC_MODEL: "x" };
    buildChildEnv(src, { ANTHROPIC_MODEL: "y" });
    expect(src.ANTHROPIC_MODEL).toBe("x");
  });

  it("profile 设同名 ANTHROPIC_ → 子进程取 profile 值", () => {
    const r = buildChildEnv(
      { ANTHROPIC_BASE_URL: "inherited" },
      { ANTHROPIC_BASE_URL: "from-profile" },
    );
    expect(r.ANTHROPIC_BASE_URL).toBe("from-profile");
  });
});

describe("hasModelEnvConflict（REQ-7 层 2 纯判定）", () => {
  it("含 ANTHROPIC_* → 返回冲突 key 列表", () => {
    expect(
      hasModelEnvConflict({ ANTHROPIC_AUTH_TOKEN: "", FOO: "bar" }),
    ).toEqual(["ANTHROPIC_AUTH_TOKEN"]);
  });

  it("含白名单 key → 冲突", () => {
    expect(hasModelEnvConflict({ CLAUDE_CODE_EFFORT_LEVEL: "max" })).toEqual([
      "CLAUDE_CODE_EFFORT_LEVEL",
    ]);
  });

  it("仅非模型 key → 无冲突", () => {
    expect(
      hasModelEnvConflict({
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      }),
    ).toEqual([]);
  });

  it("null / 空对象 → 无冲突", () => {
    expect(hasModelEnvConflict(null)).toEqual([]);
    expect(hasModelEnvConflict({})).toEqual([]);
  });
});

describe("readSettingsEnv（REQ-7 层 2 IO，只读 fail-closed）", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("文件不存在 → null（放行）", async () => {
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(false);
    expect(readSettingsEnv()).toBeNull();
  });

  it("坏 JSON → null（不阻断）", async () => {
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.default, "readFileSync").mockReturnValue("{ not json");
    expect(readSettingsEnv()).toBeNull();
  });

  it("无 env 块 → null", async () => {
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.default, "readFileSync").mockReturnValue(
      JSON.stringify({ other: 1 }),
    );
    expect(readSettingsEnv()).toBeNull();
  });

  it("env 为空对象 → 空对象（hasModelEnvConflict 据此放行）", async () => {
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.default, "readFileSync").mockReturnValue(
      JSON.stringify({ env: {} }),
    );
    expect(readSettingsEnv()).toEqual({});
  });

  it("env 含模型 key → 返回 env 供冲突检测", async () => {
    const fs = await import("node:fs");
    vi.spyOn(fs.default, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.default, "readFileSync").mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: "" } }),
    );
    const env = readSettingsEnv();
    expect(hasModelEnvConflict(env)).toEqual(["ANTHROPIC_AUTH_TOKEN"]);
  });
});
