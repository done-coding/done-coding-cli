import fs from "node:fs/promises";
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
import type { runMetaUI as RunMetaUI } from "@/utils/meta-ui";

const h = vi.hoisted(() => ({ home: "" }));
vi.mock("node:os", async (original) => {
  const actual = await original<typeof os>();
  return { ...actual, default: { ...actual, homedir: () => h.home } };
});
let runMetaUI: typeof RunMetaUI;
let settingsPath: string;
let profilePath: string;
let output: string;
let urlReady: (url: string) => void;
let sessions: Promise<Error | undefined>[] = [];
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fixture = () => ({
  version: 2,
  defaultProfile: { provider: uuid(21), account: uuid(24), model: uuid(27) },
  extra: { keep: true },
  providers: [0, 10, 20].map((base) => ({
    uuid: uuid(base + 1),
    alias: `p${base}`,
    name: `Provider ${base}`,
    url: "https://example.test",
    envExtraParams: { KEEP: "provider" },
    accounts: [2, 3, 4].map((n) => ({
      uuid: uuid(base + n),
      alias: `a${n}`,
      apiKey: `test-secret-${base + n}`,
    })),
    models: [5, 6, 7].map((n) => ({
      uuid: uuid(base + n),
      alias: `m${n}`,
      name: `model${n}`,
      envExtraParams: { KEEP: `model-${n}` },
    })),
  })),
});
const read = (file = settingsPath) =>
  fs.readFile(file, "utf8").then(JSON.parse);
const write = (value: unknown) =>
  fs.writeFile(settingsPath, JSON.stringify(value, null, 2), { mode: 0o600 });

beforeAll(async () => {
  h.home = await fs.mkdtemp(path.join(os.tmpdir(), "cc-meta-ui-"));
  settingsPath = path.join(h.home, ".done-coding/cc-switch/settings.json");
  profilePath = path.join(path.dirname(settingsPath), "profile.json");
  ({ runMetaUI } = await import("@/utils/meta-ui"));
});
beforeEach(async () => {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await write(fixture());
  await fs.writeFile(
    profilePath,
    JSON.stringify({ profiles: { "p20-a4-m7": { env: {} } } }),
  );
  output = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output += String(chunk);
    const url = String(chunk).match(
      /http:\/\/127\.0\.0\.1:\d+\/#token=[a-f0-9]+/,
    )?.[0];
    if (url) urlReady?.(url);
    return true;
  });
});
afterEach(async () => {
  await Promise.all(sessions);
  sessions = [];
  vi.restoreAllMocks();
  await fs.rm(path.join(h.home, ".done-coding"), {
    recursive: true,
    force: true,
  });
});
afterAll(() => fs.rm(h.home, { recursive: true, force: true }));

const start = async (timeoutMs = 2000) => {
  const ready = new Promise<string>((resolve) => {
    urlReady = resolve;
  });
  const done = runMetaUI({ openBrowser: false, timeoutMs });
  // 立即捕获 rejection，测试稍后核对错误；避免会话关闭时产生未处理 Promise。
  const result = done.then(
    () => undefined,
    (error: Error) => error,
  );
  sessions.push(result);
  const url = new URL(
    await Promise.race([
      ready,
      done.then(() => {
        throw new Error("未打印 URL");
      }),
    ]),
  );
  const headers = {
    Authorization: `Bearer ${url.hash.slice(7)}`,
    Origin: url.origin,
    "Content-Type": "application/json",
  };
  const submit = (value: unknown, arrayOrigins: unknown) =>
    fetch(`${url.origin}/api/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ value, arrayOrigins }),
    });
  const form = await fetch(`${url.origin}/api/form`, { headers }).then((res) =>
    res.json(),
  );
  return { form, submit, result };
};
const unchangedOrigins = () =>
  Object.fromEntries([
    ["/providers", [0, 1, 2]],
    ...[0, 1, 2].flatMap((i) => [
      [`/providers/${i}/accounts`, [0, 1, 2]],
      [`/providers/${i}/models`, [0, 1, 2]],
    ]),
  ]);

describe("meta-ui 真实 HTTP 会话（临时 HOME，禁开浏览器）", () => {
  it.each([false, true])(
    "命名空间软链允许迁移和 UI 保存，profile 缺失=%s",
    async (missingProfile) => {
      const namespace = path.join(h.home, ".done-coding");
      const realNamespace = path.join(h.home, `dotfiles-${missingProfile}`);
      await fs.rename(namespace, realNamespace);
      await fs.symlink(realNamespace, namespace);
      await write({
        providers: {
          p: {
            name: "P",
            url: "https://example.test",
            apiKey: "test-key",
            models: [{ id: "m", name: "M" }],
          },
        },
      });
      const { migrateSettingsFile } = await import("@/utils/migrate");
      const { backupPath } = migrateSettingsFile();
      const realRoot = path.join(realNamespace, "cc-switch");
      expect(await fs.realpath(settingsPath)).toBe(
        path.join(await fs.realpath(realRoot), "settings.json"),
      );
      expect((await fs.stat(settingsPath)).mode & 0o777).toBe(0o600);
      expect((await fs.stat(backupPath!)).mode & 0o777).toBe(0o600);
      if (missingProfile) await fs.unlink(profilePath);
      const { form, submit, result } = await start();
      form.value.providers[0].name = "Updated via UI";
      expect(
        (
          await submit(form.value, {
            "/providers": [0],
            "/providers/0/models": [0],
            "/providers/0/accounts": [],
          })
        ).status,
      ).toBe(200);
      expect(await result).toBeUndefined();
      expect((await read()).providers[0].name).toBe("Updated via UI");
      expect(Object.keys((await read(profilePath)).profiles)).toEqual(["p-m"]);
      for (const name of ["settings.json", "profile.json"]) {
        const realFile = path.join(await fs.realpath(realRoot), name);
        expect(
          await fs.realpath(path.join(path.dirname(settingsPath), name)),
        ).toBe(realFile);
        expect((await fs.stat(realFile)).mode & 0o777).toBe(0o600);
      }
    },
  );
  it("root 软链到命名空间外时迁移和 UI 启动都拒绝，外部不变", async () => {
    await write({
      providers: {
        p: {
          name: "P",
          url: "u",
          apiKey: "test-key",
          models: [{ id: "m", name: "M" }],
        },
      },
    });
    const root = path.dirname(settingsPath);
    const outside = path.join(h.home, "outside-root");
    await fs.rename(root, outside);
    await fs.symlink(outside, root);
    const before = await Promise.all(
      [settingsPath, profilePath].map((file) => fs.readFile(file)),
    );
    const { migrateSettingsFile } = await import("@/utils/migrate");
    expect(() => migrateSettingsFile()).toThrow(/符号链接|越界/);
    await expect(runMetaUI({ openBrowser: false })).rejects.toThrow(
      /符号链接|越界/,
    );
    expect(
      await Promise.all(
        [settingsPath, profilePath].map((file) => fs.readFile(file)),
      ),
    ).toEqual(before);
    expect((await fs.readdir(outside)).sort()).toEqual([
      "profile.json",
      "settings.json",
    ]);
  });
  it("删中间行 / 新增 / 改别名后 UUID 随行，未知值保留且默认引用解析为新 profile", async () => {
    const { form, submit, result } = await start();
    const providerSchema = form.schema.properties.providers.items;
    expect(providerSchema.properties.uuid).toBeUndefined();
    expect(
      providerSchema.properties.accounts.items.properties.uuid,
    ).toBeUndefined();
    expect(
      providerSchema.properties.models.items.properties.uuid,
    ).toBeUndefined();
    expect(form.schema.properties.defaultProfile).toBeUndefined();
    expect(providerSchema.properties.apiKey["x-dc-ui"].secret).toBe(true);
    expect(
      providerSchema.properties.accounts.items.properties.apiKey["x-dc-ui"]
        .secret,
    ).toBe(true);
    const original = fixture();
    const edited = [original.providers[0], original.providers[2]].map((p) => ({
      ...p,
      uuid: "client-must-not-replace",
      alias: `${p.alias}new`,
      accounts: [
        p.accounts[0],
        p.accounts[2],
        { alias: "fresh", apiKey: "test-fresh" },
      ],
      models: [p.models[0], p.models[2], { alias: "fresh", name: "new-model" }],
    }));
    const value = {
      ...original,
      extra: "ignored",
      providers: [
        ...edited,
        {
          alias: "new",
          name: "New",
          url: "https://example.test",
          apiKey: "test-new",
          accounts: [],
          models: [{ alias: "m", name: "new-model" }],
        },
      ],
    };
    const origins = {
      "/providers": [0, 2, null],
      "/providers/0/accounts": [0, 2, null],
      "/providers/1/accounts": [0, 2, null],
      "/providers/0/models": [0, 2, null],
      "/providers/1/models": [0, 2, null],
      "/providers/2/models": [null],
      "/providers/2/accounts": [],
    };
    expect((await submit(value, origins)).status).toBe(200);
    expect(await result).toBeUndefined();
    const saved = await read();
    expect(
      saved.providers.slice(0, 2).map((p: { uuid: string }) => p.uuid),
    ).toEqual([uuid(1), uuid(21)]);
    expect(
      saved.providers[1].accounts
        .slice(0, 2)
        .map((a: { uuid: string }) => a.uuid),
    ).toEqual([uuid(22), uuid(24)]);
    expect(
      saved.providers[1].models
        .slice(0, 2)
        .map((m: { uuid: string }) => m.uuid),
    ).toEqual([uuid(25), uuid(27)]);
    const freshIds = [
      saved.providers[2].uuid,
      saved.providers[2].models[0].uuid,
      ...saved.providers
        .slice(0, 2)
        .flatMap((p: any) => [p.accounts[2].uuid, p.models[2].uuid]),
    ];
    expect(new Set(freshIds).size).toBe(6);
    for (const id of freshIds) expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(saved.defaultProfile).toEqual(original.defaultProfile);
    expect(saved.extra).toEqual({ keep: true });
    expect(saved.providers[1].models[1].envExtraParams).toEqual({
      KEEP: "model-7",
    });
    const compiled = await read(profilePath);
    expect(compiled.defaultProfile).toBe("p20new-a4-m7");
    expect(Object.keys(compiled.profiles)).toHaveLength(19);
    expect(
      compiled.profiles[compiled.defaultProfile].env.ANTHROPIC_AUTH_TOKEN,
    ).toBe("test-secret-24");
    expect(output).toMatch(/已保存.*重建/);
    expect(output).toContain("移除的 profile：p20-a4-m7");
    expect(output).toContain("外部 --meta-profile=");
    expect(output).not.toContain("test-secret");
    expect((await fs.stat(settingsPath)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(profilePath)).mode & 0o777).toBe(0o600);
    expect((await fs.readdir(path.dirname(settingsPath))).sort()).toEqual([
      "profile.json",
      "settings.json",
    ]);
  });
  it.each([
    [undefined, true],
    [true, true],
    [false, false],
  ])("profileName 初值 %s 在表单显示并保存为 %s", async (initial, expected) => {
    await write({
      ...fixture(),
      ...(initial === undefined ? {} : { output: { profileName: initial } }),
    });
    const { form, submit, result } = await start();
    // config-ui 按 schema.default 初始化缺省标量，ElSwitch 将 undefined 显示为关闭。
    const displayed =
      form.value.output?.profileName ??
      form.schema.properties.output.properties.profileName.default ??
      false;
    expect(displayed).toBe(expected);
    expect(
      (
        await submit(
          { ...fixture(), output: { profileName: displayed } },
          unchangedOrigins(),
        )
      ).status,
    ).toBe(200);
    expect(await result).toBeUndefined();
    expect((await read(profilePath)).output.profileName).toBe(expected);
  });
  it("v1 提示先迁移且不写入", async () => {
    const legacy = {
      providers: {
        p: {
          name: "P",
          url: "u",
          apiKey: "k",
          models: [{ id: "m", name: "M" }],
        },
      },
    };
    await write(legacy);
    await expect(runMetaUI({ openBrowser: false })).rejects.toThrow(
      /--meta-migrate/,
    );
    expect(await read()).toEqual(legacy);
    expect(output).not.toContain("http://127.0.0.1");
  });
  it("字段校验失败留在页面重试，不写入", async () => {
    const { submit, result } = await start();
    const value = fixture();
    value.providers[0].alias = "invalid alias";
    expect((await submit(value, unchangedOrigins())).status).toBe(422);
    expect(await read()).toEqual(fixture());
    expect((await submit(fixture(), unchangedOrigins())).status).toBe(200);
    expect(await result).toBeUndefined();
  });
  it("多账号表单清空单密钥输入后保存，非空双凭据仍拒绝", async () => {
    const { submit, result } = await start();
    const value = {
      ...fixture(),
      providers: fixture().providers.map((p) => ({ ...p, apiKey: "" })),
    };
    expect((await submit(value, unchangedOrigins())).status).toBe(200);
    expect(await result).toBeUndefined();
    expect((await read()).providers[0]).not.toHaveProperty("apiKey");
    const next = await start();
    value.providers[0].apiKey = "test-conflict";
    expect((await next.submit(value, unchangedOrigins())).status).toBe(500);
    expect((await next.result)?.message).toMatch(/二选一/);
    expect((await read()).providers[0]).not.toHaveProperty("apiKey");
  });
  it.each(["duplicate", "default"])(
    "语义校验失败 %s 结束会话，settings/profile 均不改",
    async (kind) => {
      const before = await fs.readFile(profilePath);
      const { submit, result } = await start();
      const value = fixture();
      const origins = unchangedOrigins();
      if (kind === "duplicate")
        value.providers[1].alias = value.providers[0].alias;
      else {
        value.providers.pop();
        origins["/providers"] = [0, 1];
      }
      expect((await submit(value, origins)).status).toBe(500);
      expect((await result)?.message).toMatch(/校验失败/);
      expect(await read()).toEqual(fixture());
      expect(await fs.readFile(profilePath)).toEqual(before);
    },
  );
  it("超时有明确失败且不写入", async () => {
    await expect(
      runMetaUI({ openBrowser: false, timeoutMs: 30 }),
    ).rejects.toThrow(/超时/);
    expect(await read()).toEqual(fixture());
  });
  it.each(["settings", "profile"])(
    "保存时拒绝被换成软链的 %s，不改任何目标",
    async (target) => {
      const { submit, result } = await start();
      const file = target === "settings" ? settingsPath : profilePath;
      const outside = path.join(h.home, `outside-${target}.json`);
      await fs.writeFile(outside, "do not change");
      await fs.unlink(file);
      await fs.symlink(outside, file);
      expect((await submit(fixture(), unchangedOrigins())).status).toBe(500);
      expect((await result)?.message).toMatch(/符号链接/);
      expect(await fs.readFile(outside, "utf8")).toBe("do not change");
      if (target === "profile") expect(await read()).toEqual(fixture());
    },
  );
  it("settings 已保存但 profile 替换失败时提示显式重建，不虚报成功", async () => {
    const before = await fs.readFile(profilePath);
    const { submit, result } = await start();
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementation((from, to) => {
      if (to === profilePath)
        return Promise.reject(new Error("profile rename denied"));
      return rename(from, to);
    });
    const value = fixture();
    value.providers[0].name = "Saved source";
    expect((await submit(value, unchangedOrigins())).status).toBe(500);
    expect((await result)?.message).toMatch(
      /settings 已保存.*重建失败.*--meta-generate/,
    );
    expect((await read()).providers[0].name).toBe("Saved source");
    expect(await fs.readFile(profilePath)).toEqual(before);
    expect(output).not.toMatch(/已保存 settings，重建/);
    expect((await fs.readdir(path.dirname(settingsPath))).sort()).toEqual([
      "profile.json",
      "settings.json",
    ]);
  });
  it("原子替换失败保留原文件且清理本次临时文件", async () => {
    const { submit, result } = await start();
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("rename denied"));
    const value = fixture();
    value.providers[0].name = "Changed";
    expect((await submit(value, unchangedOrigins())).status).toBe(500);
    expect((await result)?.message).toMatch(/保存失败/);
    expect(await read()).toEqual(fixture());
    expect((await fs.readdir(path.dirname(settingsPath))).sort()).toEqual([
      "profile.json",
      "settings.json",
    ]);
  });
});
