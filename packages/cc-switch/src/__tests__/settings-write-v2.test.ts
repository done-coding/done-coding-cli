import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const h = vi.hoisted(() => ({ home: "" }));
vi.mock("node:os", async (original) => {
  const actual = await original<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual, homedir: () => h.home },
    homedir: () => h.home,
  };
});
let config: typeof import("@/utils/config");
let migration: typeof import("@/utils/migrate");
let settingsPath: string;
let profilePath: string;
const legacy = () => ({
  defaultProfile: "a-b-c",
  disabledDefault: false,
  output: { profileName: false },
  providers: {
    "a-b": {
      name: "A",
      url: "https://example.test",
      apiKey: "test-secret",
      envExtraParams: { EFFORT: "max" },
      models: [
        {
          id: "c",
          name: "m[1m]",
          envExtraParams: { ANTHROPIC_DEFAULT_HAIKU_MODEL: "h" },
        },
      ],
    },
  },
});
const write = (value: unknown) =>
  fs.writeFileSync(settingsPath, JSON.stringify(value, null, 2));
const read = () => JSON.parse(fs.readFileSync(settingsPath, "utf8"));

beforeAll(async () => {
  h.home = fs.mkdtempSync(path.join(os.tmpdir(), "cc-v2-write-"));
  settingsPath = path.join(h.home, ".done-coding/cc-switch/settings.json");
  profilePath = path.join(path.dirname(settingsPath), "profile.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  config = await import("@/utils/config");
  migration = await import("@/utils/migrate");
});
beforeEach(() => {
  write(legacy());
  if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath);
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => fs.rmSync(h.home, { recursive: true, force: true }));

describe("v1 字节兼容与显式迁移", () => {
  it("v1 generate 不改源，profile 序列化逐字节保持旧编译输出", () => {
    const source = fs.readFileSync(settingsPath);
    config.generateConfig();
    expect(fs.readFileSync(settingsPath)).toEqual(source);
    // 手工列出的旧编译字段与顺序，未调用被测实现生成期望。
    expect(fs.readFileSync(profilePath, "utf8")).toBe(
      JSON.stringify(
        {
          defaultProfile: "a-b-c",
          disabledDefault: false,
          output: { profileName: false },
          profiles: {
            "a-b-c": {
              env: {
                ANTHROPIC_BASE_URL: "https://example.test",
                ANTHROPIC_AUTH_TOKEN: "test-secret",
                ANTHROPIC_MODEL: "m[1m]",
                ANTHROPIC_DEFAULT_OPUS_MODEL: "m[1m]",
                ANTHROPIC_DEFAULT_SONNET_MODEL: "m[1m]",
                ANTHROPIC_DEFAULT_HAIKU_MODEL: "h",
                CLAUDE_CODE_SUBAGENT_MODEL: "m[1m]",
                EFFORT: "max",
              },
            },
          },
        },
        null,
        2,
      ),
    );
  });
  it("备份原字节且 600、Schema 版本正确，迁移前后 profile 字节一致", () => {
    config.generateConfig();
    const before = fs.readFileSync(profilePath);
    const source = fs.readFileSync(settingsPath);
    const result = migration.migrateSettingsFile();
    expect(result.backupPath).toMatch(/settings\.json\.v1-.*\.bak$/);
    expect(fs.readFileSync(result.backupPath!)).toEqual(source);
    expect(fs.statSync(result.backupPath!).mode & 0o777).toBe(0o600);
    expect(fs.statSync(settingsPath).mode & 0o777).toBe(0o600);
    expect(read().$schema).toBe(migration.SETTINGS_SCHEMA_URL);
    expect(read().defaultProfile.provider).toBe(read().providers[0].uuid);
    config.generateConfig();
    expect(fs.readFileSync(profilePath)).toEqual(before);
    const migrated = fs.readFileSync(settingsPath);
    const files = fs.readdirSync(path.dirname(settingsPath));
    expect(migration.migrateSettingsFile().backupPath).toBeUndefined();
    expect(fs.readFileSync(settingsPath)).toEqual(migrated);
    expect(fs.readdirSync(path.dirname(settingsPath))).toEqual(files);
  });
  it("无法解析的默认省略并提示；服务商不自动合并", () => {
    const s = legacy();
    s.defaultProfile = "missing";
    s.providers.other = s.providers["a-b"];
    write(s);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    migration.migrateSettingsFile();
    expect(read().defaultProfile).toBeUndefined();
    expect(read().providers).toHaveLength(2);
    expect(stderr.mock.calls.flat().join("")).toContain("默认 profile");
  });
  it("非法 alias 不能迁移，不写备份或修改源", () => {
    const s = legacy();
    s.providers["a-b"].models[0].id = "a/b";
    write(s);
    const before = fs.readFileSync(settingsPath);
    const files = fs.readdirSync(path.dirname(settingsPath));
    expect(() => migration.migrateSettingsFile()).toThrow(/alias/);
    expect(fs.readFileSync(settingsPath)).toEqual(before);
    expect(fs.readdirSync(path.dirname(settingsPath))).toEqual(files);
  });
  it("rename 失败时源字节保持，备份可恢复且临时文件清理", () => {
    const source = fs.readFileSync(settingsPath);
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("rename failed");
    });
    expect(() => migration.migrateSettingsFile()).toThrow("rename failed");
    expect(fs.readFileSync(settingsPath)).toEqual(source);
    expect(
      fs
        .readdirSync(path.dirname(settingsPath))
        .filter((f) => f.endsWith(".tmp")),
    ).toEqual([]);
  });
  it.each(["migration", "v1"])(
    "%s 部分写入失败也清理 scratch 并保留源",
    (mode) => {
      const source = fs.readFileSync(settingsPath);
      const originalWrite = fs.writeFileSync.bind(fs);
      vi.spyOn(fs, "writeFileSync").mockImplementation(
        (file, data, options) => {
          if (
            typeof file === "number" ||
            String(file).endsWith(".tmp") ||
            file === settingsPath
          ) {
            originalWrite(file, "partial", options);
            throw new Error("write failed");
          }
          originalWrite(file, data, options);
        },
      );
      expect(() =>
        mode === "migration"
          ? migration.migrateSettingsFile()
          : config.writeSettings(legacy()),
      ).toThrow("write failed");
      expect(fs.readFileSync(settingsPath)).toEqual(source);
      expect(
        fs
          .readdirSync(path.dirname(settingsPath))
          .filter((f) => f.endsWith(".tmp")),
      ).toEqual([]);
    },
  );
  it("settings symlink 拒绝写入，外部目标不变", () => {
    const outside = path.join(h.home, "outside.json");
    fs.writeFileSync(outside, JSON.stringify(legacy()));
    fs.unlinkSync(settingsPath);
    fs.symlinkSync(outside, settingsPath);
    try {
      expect(() => migration.migrateSettingsFile()).toThrow(/符号链接|越界/);
      expect(JSON.parse(fs.readFileSync(outside, "utf8"))).toEqual(legacy());
    } finally {
      fs.unlinkSync(settingsPath);
    }
  });
});

describe("v1 修改源也须先校验", () => {
  it("新增模型造成跨 provider profile 冲突时源不变", () => {
    write({
      providers: {
        a: {
          name: "A",
          url: "u",
          apiKey: "k",
          models: [{ id: "x", name: "x" }],
        },
        "a-b": {
          name: "B",
          url: "u",
          apiKey: "k",
          models: [{ id: "c", name: "c" }],
        },
      },
    });
    const source = fs.readFileSync(settingsPath);
    expect(() => config.addModelEntry("a", "b-c")).toThrow(/重复/);
    expect(fs.readFileSync(settingsPath)).toEqual(source);
  });
});

describe("v2 写入与改名影响", () => {
  it("新模型补 UUID，账号 key 更新仅影响指定账号", () => {
    migration.migrateSettingsFile();
    let s = read();
    delete s.defaultProfile;
    delete s.providers[0].apiKey;
    s.providers[0].accounts = [
      { alias: "157", apiKey: "first" },
      { alias: "199", apiKey: "second" },
    ];
    config.writeSettings(s);
    s = read();
    expect(s.providers[0].accounts[0].uuid).toBeTruthy();
    expect(() => config.setProviderApiKey("a-b", "new")).toThrow(
      /meta-account/,
    );
    const cfg = config.setProviderApiKey("a-b", "new", "199");
    expect(cfg.profiles["a-b-157-c"].env.ANTHROPIC_AUTH_TOKEN).toBe("first");
    expect(cfg.profiles["a-b-199-c"].env.ANTHROPIC_AUTH_TOKEN).toBe("new");
    config.addModelEntry("a-b", "next[1m]");
    s = read();
    expect(s.providers[0].models[1]).toMatchObject({
      alias: "next",
      name: "next[1m]",
      uuid: expect.any(String),
    });
    const before = fs.readFileSync(settingsPath);
    expect(() => config.addModelEntry("a-b", "invalid/name")).toThrow(/alias/);
    expect(fs.readFileSync(settingsPath)).toEqual(before);
    expect(config.providerListLines(s)[0]).toContain("账号 157 / 199");
    expect(config.modelListLines(s)[0]).toContain("账号 157 / 199");
  });
  it("改名报告移除/新增与脚本提示，无变化不输出", () => {
    migration.migrateSettingsFile();
    config.generateConfig();
    const s = read();
    s.providers[0].alias = "renamed";
    write(s);
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    config.generateConfig();
    const output = stdout.mock.calls.flat().join("");
    expect(output).toContain("移除的 profile：a-b-c");
    expect(output).toContain("新增的 profile：renamed-c");
    expect(output).toContain("--meta-profile=");
    stdout.mockClear();
    config.generateConfig();
    expect(stdout).not.toHaveBeenCalled();
  });
  it("损坏快照可由 generate 修复并提示比较不可用", () => {
    migration.migrateSettingsFile();
    fs.writeFileSync(profilePath, "bad");
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(() => config.generateConfig()).not.toThrow();
    expect(stderr.mock.calls.flat().join("")).toContain("无法比较");
    expect(
      JSON.parse(fs.readFileSync(profilePath, "utf8")).profiles["a-b-c"],
    ).toBeDefined();
  });
});
