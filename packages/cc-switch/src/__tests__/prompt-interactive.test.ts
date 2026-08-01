import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { Profile } from "@/types";

const questionImpl = { fn: () => {} };
const rlClose = vi.fn();
vi.mock("node:readline", () => ({
  default: {
    createInterface: () => {
      const rl = new EventEmitter() as EventEmitter & {
        question: unknown;
        close: unknown;
      };
      rl.question = (q: string, cb: (a: string) => void) =>
        questionImpl.fn(q, cb);
      rl.close = rlClose;
      return rl;
    },
  },
  createInterface: () => {
    const rl = new EventEmitter() as EventEmitter & {
      question: unknown;
      close: unknown;
    };
    rl.question = (q: string, cb: (a: string) => void) =>
      questionImpl.fn(q, cb);
    rl.close = rlClose;
    return rl;
  },
}));

const { fillEmptyEnv, releaseStdin, PromptAbortError } =
  await import("@/utils/prompt");
type ProfileT = Profile;

class FakeStdin extends EventEmitter {
  public setRawMode = vi.fn();
  public resume = vi.fn();
  public pause = vi.fn();
  public setEncoding = vi.fn();
}

afterEach(() => {
  vi.restoreAllMocks();
  rlClose.mockReset();
});

describe("fillEmptyEnv（REQ-5/6）", () => {
  it("token 类键走遮蔽输入（readSecret，raw 模式），不回显明文", async () => {
    const fake = new FakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(fake as never);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const profile: ProfileT = { env: { ANTHROPIC_AUTH_TOKEN: "" } };
    const p = fillEmptyEnv(profile);
    setImmediate(() => {
      fake.emit("data", "s");
      fake.emit("data", "k");
      fake.emit("data", "\r");
    });
    await p;

    expect(fake.setRawMode).toHaveBeenCalledWith(true);
    expect(profile.env.ANTHROPIC_AUTH_TOKEN).toBe("sk");
    const written = stderr.mock.calls.map((c) => String(c[0])).join("");
    expect(written).not.toContain("sk");
  });

  it("普通键走回显输入（readline，走 stderr）", async () => {
    const fake = new FakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(fake as never);
    questionImpl.fn = (_q, cb) => cb("https://x");

    const profile: ProfileT = { env: { ANTHROPIC_BASE_URL: "" } };
    await fillEmptyEnv(profile);
    expect(profile.env.ANTHROPIC_BASE_URL).toBe("https://x");
  });

  it("空回车 → 视为仍空，重新提示同键", async () => {
    const fake = new FakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(fake as never);
    let round = 0;
    questionImpl.fn = (_q, cb) => {
      round += 1;
      cb(round === 1 ? "" : "filled");
    };

    const profile: ProfileT = { env: { ANTHROPIC_MODEL: "" } };
    await fillEmptyEnv(profile);
    expect(round).toBe(2);
    expect(profile.env.ANTHROPIC_MODEL).toBe("filled");
  });

  it("Ctrl+C → 抛 PromptAbortError（调用方据此不回写）", async () => {
    const fake = new FakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(fake as never);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const profile: ProfileT = { env: { API_KEY: "" } };
    const p = fillEmptyEnv(profile);
    setImmediate(() => fake.emit("data", String.fromCharCode(3)));
    await expect(p).rejects.toBeInstanceOf(PromptAbortError);
    expect(profile.env.API_KEY).toBe("");
  });

  it("EOF (Ctrl+D) → 抛 PromptAbortError", async () => {
    const fake = new FakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(fake as never);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const profile: ProfileT = { env: { SECRET_X: "" } };
    const p = fillEmptyEnv(profile);
    setImmediate(() => fake.emit("data", String.fromCharCode(4)));
    await expect(p).rejects.toBeInstanceOf(PromptAbortError);
  });
});

describe("releaseStdin（REQ-5 spawn 前 stdin 干净移交）", () => {
  it("曾设 raw → setRawMode(false) + pause", async () => {
    const fake = new FakeStdin();
    vi.spyOn(process, "stdin", "get").mockReturnValue(fake as never);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);

    const profile: ProfileT = { env: { TOKEN_X: "" } };
    const p = fillEmptyEnv(profile);
    setImmediate(() => {
      fake.emit("data", "v");
      fake.emit("data", "\r");
    });
    await p;

    releaseStdin();
    expect(fake.setRawMode).toHaveBeenCalledWith(false);
    expect(fake.pause).toHaveBeenCalled();
  });
});
