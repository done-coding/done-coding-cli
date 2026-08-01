import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import {
  loadOrInitConfig,
  writeConfig,
  DEEPSEEK_TEMPLATE,
} from "@/utils/config";
import { PROFILE_PATH } from "@/utils/path";

describe("writeConfig（REQ-2/3 mkdir→write→chmod 600）", () => {
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

    writeConfig(DEEPSEEK_TEMPLATE);

    expect(calls).toEqual(["mkdir", "write", "chmod"]);
    expect(chmod).toHaveBeenCalledWith(PROFILE_PATH, 0o600);
  });
});

describe("loadOrInitConfig（REQ-2/3/4 校验）", () => {
  afterEach(() => vi.restoreAllMocks());

  it("文件不存在 → 写模板（chmod 600）后返回模板", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);

    const cfg = loadOrInitConfig();
    expect(cfg).toBe(DEEPSEEK_TEMPLATE);
    expect(write).toHaveBeenCalled();
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

  it("缺 defaultProfile → throw 带路径", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({ profiles: {} }) as never,
    );
    expect(() => loadOrInitConfig()).toThrowError(/defaultProfile/);
    expect(() => loadOrInitConfig()).toThrowError(
      new RegExp(PROFILE_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
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
