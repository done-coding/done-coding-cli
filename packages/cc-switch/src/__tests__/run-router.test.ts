import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs";

import { resolveHandlerContext, xPrompts } from "@done-coding/cli-utils";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock("@done-coding/cli-utils", () => ({
  resolveHandlerContext: vi.fn(),
  xPrompts: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveHandlerContext);
const mockedXPrompts = vi.mocked(xPrompts);

const { runRouter } = await import("@/handlers");

class FakeChild extends EventEmitter {}

/** process.exit 抛错以中断 runRouter 流程，断言退出码。 */
class ExitSignal extends Error {
  public constructor(public code: number) {
    super(`exit:${code}`);
  }
}

const validCfg = {
  defaultProfile: "deepseek",
  profiles: {
    deepseek: { env: { ANTHROPIC_MODEL: "m1", FOO: "bar" } },
  },
};

/** settings.json 源（provider-list / model-list / generate 用例用）。 */
const settingsFixture = {
  defaultProfile: "deepseek-flash",
  providers: {
    deepseek: {
      name: "DeepSeek",
      url: "https://api.deepseek.com/anthropic",
      apiKey: "sk-test",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
      models: [{ id: "flash", name: "deepseek-v4-flash[1m]" }],
    },
    "ark-agent-plan": {
      name: "火山方舟 plan",
      url: "https://ark.cn-beijing.volces.com/api/plan",
      apiKey: "ark-test-plan",
      models: [{ id: "glm", name: "glm-5.2[1m]" }],
    },
  },
};

describe("runRouter（REQ-1/4/7 + 决策 3/5）", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdout: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spawnMock.mockReset();
    mockedResolve.mockReset();
    mockedXPrompts.mockReset();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitSignal(code ?? 0);
    }) as never);
    stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.spyOn(fs, "existsSync").mockImplementation((p: fs.PathLike) =>
      String(p).endsWith("profile.json"),
    );
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify(validCfg) as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("REQ-1：strip-then-inject + 启动前输出 profile 名一行 + stdio inherit + passthrough 原样 + 退出码透传", async () => {
    process.argv = ["node", "cc-router", "--meta-profile=deepseek", "-v", "hi"];
    process.env.ANTHROPIC_BASE_URL = "leaked-from-shell";

    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 42, null));

    await run.catch((e) => {
      expect((e as ExitSignal).code).toBe(42);
    });

    const [bin, args, opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { stdio: string; shell: boolean; env: Record<string, string> },
    ];
    expect(bin).toBe("claude");
    expect(args).toEqual(["-v", "hi"]);
    expect(opts.stdio).toBe("inherit");
    expect(opts.shell).toBe(false);
    expect(opts.env.ANTHROPIC_MODEL).toBe("m1");
    expect(opts.env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(opts.env.FOO).toBe("bar");

    // REQ-1：spawn 前输出 profile 名（纯名一行）
    expect(stdout).toHaveBeenCalledWith("deepseek\n");

    delete process.env.ANTHROPIC_BASE_URL;
  });

  it("REQ-2：--meta-silent → 不输出 profile 名，spawn 参数不受影响", async () => {
    process.argv = [
      "node",
      "cc-router",
      "--meta-silent",
      "--meta-profile=deepseek",
      "hi",
    ];
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 0, null));
    await run.catch(() => undefined);

    expect(stdout).not.toHaveBeenCalledWith("deepseek\n");
    const [bin, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(bin).toBe("claude");
    expect(args).toEqual(["hi"]);
  });

  it("REQ-1：配置 output.profileName=false → 不输出", async () => {
    process.argv = ["node", "cc-router", "--meta-profile=deepseek"];
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        defaultProfile: "deepseek",
        output: { profileName: false },
        profiles: {
          deepseek: { env: { ANTHROPIC_MODEL: "m1" } },
        },
      }) as never,
    );
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 0, null));
    await run.catch(() => undefined);

    expect(stdout).not.toHaveBeenCalledWith("deepseek\n");
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("REQ-5：disabledDefault=true 且未显式 → 交互 pick 选中后启动 + 输出选中名", async () => {
    process.argv = ["node", "cc-router", "hi"];
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        defaultProfile: "deepseek",
        disabledDefault: true,
        profiles: {
          deepseek: { env: { ANTHROPIC_MODEL: "m1" } },
        },
      }) as never,
    );
    mockedResolve.mockReturnValue({ interactive: true } as never);
    mockedXPrompts.mockResolvedValue({ profile: "deepseek" } as never);
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 0, null));
    await run.catch(() => undefined);

    expect(mockedXPrompts).toHaveBeenCalledWith(
      expect.objectContaining({ type: "select" }),
    );
    expect(stdout).toHaveBeenCalledWith("deepseek\n");
    const [bin, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(bin).toBe("claude");
    expect(args).toEqual(["hi"]);
  });

  it("REQ-5：无 defaultProfile 且未显式 → 交互 pick（不报错）", async () => {
    process.argv = ["node", "cc-router"];
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        profiles: {
          deepseek: { env: { ANTHROPIC_MODEL: "m1" } },
          ark: { env: { ANTHROPIC_MODEL: "m2" } },
        },
      }) as never,
    );
    mockedResolve.mockReturnValue({ interactive: true } as never);
    mockedXPrompts.mockResolvedValue({ profile: "ark" } as never);
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 0, null));
    await run.catch(() => undefined);

    expect(mockedXPrompts).toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith("ark\n");
    const [, , opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    expect(opts.env.ANTHROPIC_MODEL).toBe("m2");
  });

  it("REQ-5：显式 --meta-profile 优先于 disabledDefault（不调 pick）", async () => {
    process.argv = ["node", "cc-router", "--meta-profile=deepseek"];
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        defaultProfile: "deepseek",
        disabledDefault: true,
        profiles: {
          deepseek: { env: { ANTHROPIC_MODEL: "m1" } },
        },
      }) as never,
    );
    mockedResolve.mockReturnValue({ interactive: true } as never);
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 0, null));
    await run.catch(() => undefined);

    expect(mockedXPrompts).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith("deepseek\n");
  });

  it("signal 非空 → 128+signum 退出（SIGINT=2 → 130）", async () => {
    process.argv = ["node", "cc-router"];
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", null, "SIGINT"));

    await run.catch((e) => {
      expect((e as ExitSignal).code).toBe(130);
    });
    expect(exitSpy).toHaveBeenCalledWith(130);
  });

  it("ENOENT → 一行报错 + 退出 127", async () => {
    process.argv = ["node", "cc-router"];
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => {
      const err: NodeJS.ErrnoException = new Error("spawn claude ENOENT");
      err.code = "ENOENT";
      child.emit("error", err);
    });

    await run.catch((e) => {
      expect((e as ExitSignal).code).toBe(127);
    });
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("未找到 claude"),
    );
  });

  it("REQ-7 层 2：settings.json env 含模型 key → fail-closed 非 0 退出，不 spawn", async () => {
    process.argv = ["node", "cc-router"];
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation(
      (p: fs.PathOrFileDescriptor) => {
        if (String(p).endsWith("settings.json")) {
          return JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: "x" } });
        }
        return JSON.stringify(validCfg);
      },
    );

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(1);
    });

    expect(spawnMock).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("ANTHROPIC_AUTH_TOKEN"),
    );
  });

  it("REQ-4：--meta-help → 输出帮助 + exit(0)，不读配置不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-help"];

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(spawnMock).not.toHaveBeenCalled();
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("--meta-pick");
    expect(out).toContain("--meta-silent");
    expect(out).toContain("--meta-version");
  });

  it("REQ-5：--meta-version → 输出版本 + exit(0)，不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-version"];

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(spawnMock).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      expect.stringMatching(/^\d+\.\d+\.\d+\n$/),
    );
  });

  it("REQ-3：--meta-pick TTY 选中 → 以选中 profile 启动（等价显式指定）", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-pick", "hi"];
    mockedResolve.mockReturnValue({ interactive: true } as never);
    mockedXPrompts.mockResolvedValue({ profile: "deepseek" } as never);
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);

    const run = runRouter();
    setImmediate(() => child.emit("exit", 0, null));
    await run.catch(() => undefined);

    expect(mockedXPrompts).toHaveBeenCalledWith(
      expect.objectContaining({ type: "select" }),
    );
    expect(stdout).toHaveBeenCalledWith("deepseek\n");
    const [bin, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(bin).toBe("claude");
    expect(args).toEqual(["hi"]);
  });

  it("--meta-generate：读 settings 源 → 写 profile.json → exit(0)，不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-generate"];
    vi.spyOn(fs, "existsSync").mockImplementation((p) =>
      String(p).endsWith("settings.json"),
    );
    vi.mocked(fs.readFileSync).mockImplementation(
      () => JSON.stringify(settingsFixture) as never,
    );
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining("profile.json"),
      expect.stringContaining('"deepseek-flash"'),
    );
    expect(chmod).toHaveBeenCalledWith(
      expect.stringContaining("profile.json"),
      0o600,
    );
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("已生成 2 个 profile");
  });

  it("--meta-provider-list：输出提供商列表 + exit(0)，不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-provider-list"];
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("settings.json"),
    );
    vi.mocked(fs.readFileSync).mockImplementation(
      () => JSON.stringify(settingsFixture) as never,
    );

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(spawnMock).not.toHaveBeenCalled();
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("deepseek（DeepSeek）");
    expect(out).toContain("ark-agent-plan（火山方舟 plan）");
    expect(out).not.toContain("sk-");
  });

  it("--meta-model-list：输出模型列表（name+provider）+ exit(0)，不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-model-list"];
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("settings.json"),
    );
    vi.mocked(fs.readFileSync).mockImplementation(
      () => JSON.stringify(settingsFixture) as never,
    );

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(spawnMock).not.toHaveBeenCalled();
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("deepseek-v4-flash[1m]（deepseek）");
    expect(out).toContain("glm-5.2[1m]（ark-agent-plan）");
  });
});
