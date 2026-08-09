import { describe, it, expect } from "vitest";
import { parseArgv } from "@/handlers/profile";

describe("parseArgv（REQ-1/2/6）", () => {
  it("零参数 → action=run，无 profileName，silent=false，空 passthrough", () => {
    expect(parseArgv([])).toEqual({
      action: "run",
      profileName: undefined,
      apiKey: undefined,
      modelName: undefined,
      providerId: undefined,
      silent: false,
      passthrough: [],
    });
  });

  it("无 meta：-v 与自然语言串原样透传", () => {
    const r = parseArgv(["-v", "改个 bug"]);
    expect(r.action).toBe("run");
    expect(r.profileName).toBeUndefined();
    expect(r.silent).toBe(false);
    expect(r.passthrough).toEqual(["-v", "改个 bug"]);
  });

  it("--meta-profile=foo -v：meta 被消费且不透传，-v 原样透传", () => {
    const r = parseArgv(["--meta-profile=foo", "-v"]);
    expect(r.action).toBe("profile");
    expect(r.profileName).toBe("foo");
    expect(r.passthrough).toEqual(["-v"]);
  });

  it("多个 --meta-profile= → 取最后一个生效，其余不透传", () => {
    const r = parseArgv(["--meta-profile=a", "x", "--meta-profile=b", "y"]);
    expect(r.profileName).toBe("b");
    expect(r.passthrough).toEqual(["x", "y"]);
  });

  it("REQ-2：--meta-silent → silent=true，被消费且不透传", () => {
    const r = parseArgv(["--meta-silent", "-v", "hi"]);
    expect(r.silent).toBe(true);
    expect(r.action).toBe("run");
    expect(r.passthrough).toEqual(["-v", "hi"]);
  });

  it("REQ-2：--meta-silent 与 pick 并存 → 动作不受影响，silent 仍生效", () => {
    const r = parseArgv(["--meta-pick", "--meta-silent"]);
    expect(r.action).toBe("pick");
    expect(r.silent).toBe(true);
    expect(r.passthrough).toEqual([]);
  });

  it("REQ-1：未知 meta 前缀 fail-fast throw（不透传不静默）", () => {
    expect(() => parseArgv(["--meta-xxx", "--help"])).toThrow(/未知 meta 选项/);
  });

  it("REQ-1：--help 非 meta 前缀 → 原样透传", () => {
    const r = parseArgv(["--help"]);
    expect(r.action).toBe("run");
    expect(r.passthrough).toEqual(["--help"]);
  });

  it("REQ-3/4/5：--meta-pick / --meta-help / --meta-version 识别且不透传", () => {
    expect(parseArgv(["--meta-pick", "x"]).action).toBe("pick");
    expect(parseArgv(["--meta-help", "x"]).action).toBe("help");
    expect(parseArgv(["--meta-version", "x"]).action).toBe("version");
    expect(parseArgv(["--meta-pick", "x"]).passthrough).toEqual(["x"]);
  });

  it("REQ-6：优先级 help > version > pick > profile，并存取高者", () => {
    expect(parseArgv(["--meta-pick", "--meta-profile=a"]).action).toBe("pick");
    expect(parseArgv(["--meta-profile=a", "--meta-version"]).action).toBe(
      "version",
    );
    expect(parseArgv(["--meta-help", "--meta-version"]).action).toBe("help");
    expect(
      parseArgv(["--meta-help", "--meta-pick", "--meta-profile=a"]).action,
    ).toBe("help");
    // 高优先级动作不影响透传
    const r = parseArgv(["--meta-help", "--meta-version", "/clear"]);
    expect(r.passthrough).toEqual(["/clear"]);
  });

  it("[MUST NOT] 对透传参数做归一化（保留引号/空格原样）", () => {
    const r = parseArgv(["  spaced  ", '"quoted"']);
    expect(r.passthrough).toEqual(["  spaced  ", '"quoted"']);
  });

  it("空值 --meta-profile= → profileName 为空字符串（确定行为）", () => {
    const r = parseArgv(["--meta-profile="]);
    expect(r.profileName).toBe("");
    expect(r.passthrough).toEqual([]);
  });
});
