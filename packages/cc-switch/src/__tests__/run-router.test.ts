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

describe("runRouter（REQ-1/4/7 + 决策 3/5）", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spawnMock.mockReset();
    mockedResolve.mockReset();
    mockedXPrompts.mockReset();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitSignal(code ?? 0);
    }) as never);
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

  it("strip-then-inject：注入 profile env + stdio inherit + passthrough 原样 + 退出码透传", async () => {
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

    delete process.env.ANTHROPIC_BASE_URL;
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
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);

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
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);

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
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(spawnMock).not.toHaveBeenCalled();
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("--meta-pick");
    expect(out).toContain("--meta-version");
  });

  it("REQ-5：--meta-version → 输出版本 + exit(0)，不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-version"];
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

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
    const [bin, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(bin).toBe("claude");
    expect(args).toEqual(["hi"]);
  });

  it("--meta-generate：读源 → 写 profile.json → exit(0)，不 spawn", async () => {
    process.argv = ["node", "dc-cc-switch", "--meta-generate"];
    const providerCfg = {
      providers: {
        deepseek: {
          name: "DeepSeek",
          url: "https://api.deepseek.com/anthropic",
          apiKey: "sk-test",
          envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
        },
      },
    };
    const modelCfg = {
      defaultProfile: "deepseek-flash",
      models: [
        { provider: "deepseek", id: "flash", name: "deepseek-v4-flash[1m]" },
        {
          provider: "deepseek",
          id: "pro",
          name: "deepseek-v4-pro[1m]",
          envExtraParams: {
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
          },
        },
      ],
    };
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return (
        s.endsWith("provider.json") ||
        s.endsWith("model.json") ||
        s.endsWith("profile.json")
      );
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith("provider.json")) {
        return JSON.stringify(providerCfg) as never;
      }
      if (s.endsWith("model.json")) return JSON.stringify(modelCfg) as never;
      return "" as never;
    });
    const write = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation((() => undefined) as never);
    const chmod = vi
      .spyOn(fs, "chmodSync")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(fs, "mkdirSync").mockImplementation((() => undefined) as never);
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining("profile.json"),
      expect.stringContaining('"deepseek-pro"'),
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
      String(p).endsWith("provider.json"),
    );
    vi.mocked(fs.readFileSync).mockImplementation(
      () =>
        JSON.stringify({
          providers: {
            deepseek: { name: "DeepSeek", url: "u", apiKey: "k" },
            "ark-agent-plan": {
              name: "火山方舟 plan",
              url: "u",
              apiKey: "k",
            },
          },
        }) as never,
    );
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

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
      String(p).endsWith("model.json"),
    );
    vi.mocked(fs.readFileSync).mockImplementation(
      () =>
        JSON.stringify({
          defaultProfile: "deepseek-flash",
          models: [
            {
              provider: "deepseek",
              id: "flash",
              name: "deepseek-v4-flash[1m]",
            },
            { provider: "ark-agent-plan", id: "glm", name: "glm-5.2[1m]" },
          ],
        }) as never,
    );
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await runRouter().catch((e) => {
      expect((e as ExitSignal).code).toBe(0);
    });
    expect(spawnMock).not.toHaveBeenCalled();
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("deepseek-v4-flash[1m]（deepseek）");
    expect(out).toContain("glm-5.2[1m]（ark-agent-plan）");
  });
});
