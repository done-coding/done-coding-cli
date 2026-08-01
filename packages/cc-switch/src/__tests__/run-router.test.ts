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
});
