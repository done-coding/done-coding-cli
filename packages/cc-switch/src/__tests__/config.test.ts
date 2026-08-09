import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import { loadOrInitConfig, writeConfig } from "@/utils/config";
import { PROFILE_PATH, SETTINGS_PATH } from "@/utils/path";

const sampleCfg = {
  defaultProfile: "a",
  profiles: { a: { env: { K: "v" } } },
};

describe("writeConfig（mkdir→write→chmod 600）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("固定时序：mkdir(recursive) → writeFile → chmod 0o600", () => {
    const calls: string[] = [];
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => {
      calls.push("mkdir");
      return undefined;
    }) as typeof fs.mkdirSync);
    vi.spyOn(fs, "writeFileSync").mockImplementation((() => {
      calls.push("write");
    }) as typeof fs.writeFileSync);
    const chmod = vi.spyOn(fs, "chmodSync").mockImplementation((() => {
      calls.push("chmod");
    }) as typeof fs.chmodSync);

    writeConfig(sampleCfg);

    expect(calls).toEqual(["mkdir", "write", "chmod"]);
    expect(chmod).toHaveBeenCalledWith(PROFILE_PATH, 0o600);
  });
});

describe("loadOrInitConfig（运行时读编译快照，校验放宽 defaultProfile 可选）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("profile.json 缺失但 settings.json 存在 → throw 提示 --meta-generate，不写任何文件", () => {
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "existsSync").mockImplementation((p) =>
      String(p).endsWith("settings.json"),
    );
    expect(() => loadOrInitConfig()).toThrowError(/--meta-generate/);
    expect(write).not.toHaveBeenCalled();
  });

  it("纯新装（两者皆无）→ 写 starter settings + 编译 profile.json（均 600）", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);

    const cfg = loadOrInitConfig();
    expect(cfg.profiles["deepseek-pro"]).toBeDefined();
    expect(cfg.profiles["deepseek-flash"]).toBeDefined();
    expect(cfg.defaultProfile).toBe("deepseek-pro");
    // 两次写入：settings.json（源）+ profile.json（编译快照）
    expect(write).toHaveBeenCalledTimes(2);
    expect(chmod).toHaveBeenCalledWith(SETTINGS_PATH, 0o600);
    expect(chmod).toHaveBeenCalledWith(PROFILE_PATH, 0o600);
  });

  it("非法 JSON → throw 带绝对路径，[MUST NOT] 覆盖", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ broken json" as never);
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);

    try {
      loadOrInitConfig();
      throw new Error("should throw");
    } catch (e) {
      expect((e as Error).message).toContain(PROFILE_PATH);
      expect((e as Error).message).toContain("非法 JSON");
    }
    expect(write).not.toHaveBeenCalled();
  });

  it("defaultProfile 省略 → 合法（可选语义）", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ profiles: { a: { env: {} } } }) as never,
    );
    const cfg = loadOrInitConfig();
    expect(cfg.defaultProfile).toBeUndefined();
  });

  it("defaultProfile 非字符串 → throw 带路径", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ defaultProfile: 42, profiles: {} }) as never,
    );
    expect(() => loadOrInitConfig()).toThrowError(/defaultProfile/);
    expect(() => loadOrInitConfig()).toThrowError(
      new RegExp(PROFILE_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("disabledDefault / output.profileName 非布尔 → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        disabledDefault: "yes",
        profiles: { a: { env: {} } },
      }) as never,
    );
    expect(() => loadOrInitConfig()).toThrowError(/disabledDefault/);

    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        output: { profileName: "yes" },
        profiles: { a: { env: {} } },
      }) as never,
    );
    expect(() => loadOrInitConfig()).toThrowError(/profileName/);
  });

  it("缺 profiles → throw", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ defaultProfile: "x" }) as never,
    );
    expect(() => loadOrInitConfig()).toThrowError(/profiles/);
  });

  it("合法配置 → 解析返回", () => {
    const valid = {
      defaultProfile: "a",
      profiles: { a: { env: { K: "v" } } },
    };
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(valid) as never,
    );
    expect(loadOrInitConfig()).toEqual(valid);
  });
});
