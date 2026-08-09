import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  isUnknownMetaOption,
  mergeAction,
  pickProfile,
  printMetaHelp,
  printMetaVersion,
} from "@/utils/meta";
import { resolveHandlerContext, xPrompts } from "@done-coding/cli-utils";

vi.mock("@done-coding/cli-utils", () => ({
  resolveHandlerContext: vi.fn(),
  xPrompts: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveHandlerContext);
const mockedXPrompts = vi.mocked(xPrompts);

/** process.exit 抛错以中断流程，断言退出码。 */
class ExitSignal extends Error {
  public constructor(public code: number) {
    super(`exit:${code}`);
  }
}

describe("mergeAction / isUnknownMetaOption（REQ-1/6）", () => {
  it("优先级分值归并：run<profile<pick<version<help", () => {
    expect(mergeAction("run", "profile")).toBe("profile");
    expect(mergeAction("profile", "pick")).toBe("pick");
    expect(mergeAction("pick", "version")).toBe("version");
    expect(mergeAction("version", "help")).toBe("help");
    expect(mergeAction("help", "pick")).toBe("help");
  });

  it("已知 meta 前缀不判未知；其余 --meta-* 判未知", () => {
    expect(isUnknownMetaOption("--meta-profile=a")).toBe(false);
    expect(isUnknownMetaOption("--meta-pick")).toBe(false);
    expect(isUnknownMetaOption("--meta-silent")).toBe(false);
    expect(isUnknownMetaOption("--meta-help")).toBe(false);
    expect(isUnknownMetaOption("--meta-version")).toBe(false);
    expect(isUnknownMetaOption("--meta-xxx")).toBe(true);
    expect(isUnknownMetaOption("--meta-pick=x")).toBe(true);
    expect(isUnknownMetaOption("--meta-silent=x")).toBe(true);
    expect(isUnknownMetaOption("--help")).toBe(false);
  });
});

describe("printMetaHelp / printMetaVersion（REQ-4/5）", () => {
  let stdout: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("REQ-4：帮助含 meta 选项 + 配置路径 + 源路径", () => {
    printMetaHelp();
    const out = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(out).toContain("--meta-profile=<name>");
    expect(out).toContain("--meta-pick");
    expect(out).toContain("--meta-silent");
    expect(out).toContain("--meta-help");
    expect(out).toContain("--meta-version");
    expect(out).toContain(".done-coding/cc-switch/profile.json");
    expect(out).toContain(".done-coding/cc-switch/settings.json");
    expect(out).toContain("不透传给 claude");
  });

  it("REQ-5：版本输出注入值 + 换行", () => {
    printMetaVersion("9.9.9");
    expect(stdout).toHaveBeenCalledWith("9.9.9\n");
  });
});

describe("pickProfile（REQ-3/7）", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  const cfg = {
    defaultProfile: "a",
    profiles: {
      a: { env: { X: "1" } },
      b: { env: { X: "2" } },
    },
  };

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitSignal(code ?? 0);
    }) as never);
    stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    mockedResolve.mockReset();
    mockedXPrompts.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("REQ-3：TTY 交互选中 → 返回选中名；choices 为 profiles 键名", async () => {
    mockedResolve.mockReturnValue({ interactive: true } as never);
    mockedXPrompts.mockResolvedValue({ profile: "b" } as never);

    await expect(pickProfile(cfg)).resolves.toBe("b");
    expect(mockedXPrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "select",
        name: "profile",
        choices: [
          { title: "a", value: "a" },
          { title: "b", value: "b" },
        ],
      }),
    );
  });

  it("REQ-7：非 TTY → stderr 提示改用 --meta-profile=<name> + exit(1)，不调 prompts", async () => {
    mockedResolve.mockReturnValue({ interactive: false } as never);

    await expect(pickProfile(cfg)).rejects.toBeInstanceOf(ExitSignal);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("--meta-profile=<name>"),
    );
    expect(mockedXPrompts).not.toHaveBeenCalled();
  });

  it("空 profiles → stderr 提示编辑配置 + exit(1)，不调 prompts", async () => {
    mockedResolve.mockReturnValue({ interactive: true } as never);

    await expect(
      pickProfile({ defaultProfile: "x", profiles: {} }),
    ).rejects.toBeInstanceOf(ExitSignal);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("profile"));
    expect(mockedXPrompts).not.toHaveBeenCalled();
  });
});
