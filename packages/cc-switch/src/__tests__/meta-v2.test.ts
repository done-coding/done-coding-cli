import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveHandlerContext, xPrompts } from "@done-coding/cli-utils";
import { parseArgv } from "@/handlers/profile";
import { selectAccount, selectProvider } from "@/utils/meta";
vi.mock("@done-coding/cli-utils", () => ({
  resolveHandlerContext: vi.fn(),
  xPrompts: vi.fn(),
}));
const provider = {
  uuid: "00000000-0000-4000-8000-000000000001",
  alias: "ark",
  name: "A",
  url: "u",
  models: [],
  accounts: [
    {
      uuid: "00000000-0000-4000-8000-000000000002",
      alias: "157",
      apiKey: "secret",
    },
  ],
};
afterEach(() => vi.restoreAllMocks());
describe("v2 meta 命令", () => {
  it("migrate 与 account 被消费不透传，help/version 仍优先", () => {
    expect(parseArgv(["--meta-migrate"]).action).toBe("migrate");
    expect(parseArgv(["--meta-migrate", "--meta-help"]).action).toBe("help");
    expect(parseArgv(["--meta-migrate", "--meta-version"]).action).toBe(
      "version",
    );
    expect(
      parseArgv([
        "--meta-provider=ark",
        "--meta-account=157",
        "--meta-apiKey=test",
        "hello",
      ]),
    ).toMatchObject({
      action: "setkey",
      accountAlias: "157",
      providerId: "ark",
      passthrough: ["hello"],
    });
  });
  it.each([
    ["--meta-account=157"],
    ["--meta-account=157", "--meta-model-name=m"],
    ["--meta-account=", "--meta-apiKey=k"],
    ["--meta-migrate", "--meta-generate"],
    ["--meta-migrate", "--meta-apiKey=k"],
    ["--meta-migrate", "--meta-model-name=m"],
  ])("不兼容组合 fail-fast %s", (...args) => {
    expect(() => parseArgv(args)).toThrow();
  });
  it("v2 provider 选择返回 alias，account 选择不含 key", async () => {
    vi.mocked(resolveHandlerContext).mockReturnValue({
      interactive: true,
    } as never);
    vi.mocked(xPrompts)
      .mockResolvedValueOnce({ provider: "ark" })
      .mockResolvedValueOnce({ account: "157" });
    expect(await selectProvider({ version: 2, providers: [provider] })).toBe(
      "ark",
    );
    expect(await selectAccount(provider)).toBe("157");
    expect(JSON.stringify(vi.mocked(xPrompts).mock.calls)).not.toContain(
      "secret",
    );
  });
  it("非 TTY account 缺参立即失败，指向参数替代路径", async () => {
    vi.mocked(resolveHandlerContext).mockReturnValue({
      interactive: false,
    } as never);
    await expect(selectAccount(provider)).rejects.toThrow(/--meta-account=/);
  });
});

describe("meta-ui 参数", () => {
  it("消费 ui，保留 silent 和透传参数，help/version 仍优先", () => {
    expect(parseArgv(["--meta-ui", "--meta-silent", "hello"])).toMatchObject({
      action: "ui",
      silent: true,
      passthrough: ["hello"],
    });
    expect(parseArgv(["--meta-ui", "--meta-help"]).action).toBe("help");
    expect(parseArgv(["--meta-ui", "--meta-version"]).action).toBe("version");
  });
  it.each([
    "--meta-migrate",
    "--meta-generate",
    "--meta-apiKey=k",
    "--meta-model-name=m",
    "--meta-pick",
    "--meta-profile=p",
    "--meta-provider-list",
    "--meta-model-list",
    "--meta-provider=p",
    "--meta-account=a",
  ])("拒绝 ui 与 %s 混用", (other) => {
    expect(() => parseArgv(["--meta-ui", other])).toThrow(/--meta-ui.*不能/);
    expect(() => parseArgv([other, "--meta-ui"])).toThrow(/--meta-ui.*不能/);
  });
});
