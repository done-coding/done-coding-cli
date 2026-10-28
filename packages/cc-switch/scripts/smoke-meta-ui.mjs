import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// 只用构建产物和一次性 HOME；pipe 模式使 --meta-ui 明确 openBrowser:false。
const home = await fs.mkdtemp(path.join(os.tmpdir(), "cc-meta-ui-smoke-"));
const root = path.join(home, ".done-coding/cc-switch");
const settingsPath = path.join(root, "settings.json");
const profilePath = path.join(root, "profile.json");
const cli = fileURLToPath(new URL("../es/cli.mjs", import.meta.url));
const children = new Set();
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fixture = () => ({
  version: 2,
  defaultProfile: { provider: uuid(21), account: uuid(24), model: uuid(27) },
  unmanaged: "keep",
  providers: [0, 10, 20].map((base) => ({
    uuid: uuid(base + 1),
    alias: `p${base}`,
    name: "Provider",
    url: "https://example.test",
    accounts: [2, 3, 4].map((n) => ({
      uuid: uuid(base + n),
      alias: `a${n}`,
      apiKey: `test-secret-${base + n}`,
    })),
    models: [5, 6, 7].map((n) => ({
      uuid: uuid(base + n),
      alias: `m${n}`,
      name: `model${n}`,
      envExtraParams: { KEEP: `${n}` },
    })),
  })),
});
const write = (value) =>
  fs.writeFile(settingsPath, JSON.stringify(value, null, 2), { mode: 0o600 });
const read = (file) => fs.readFile(file, "utf8").then(JSON.parse);
function run(args) {
  const child = spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  let stdout = "",
    stderr = "",
    ready;
  const url = new Promise((resolve) => {
    ready = resolve;
  });
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+\/#token=[a-f0-9]+/);
    if (match) ready(new URL(match[0]));
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 15000);
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      resolve({ code, signal, stdout, stderr });
    });
  });
  return {
    done,
    url: Promise.race([
      url,
      done.then((result) => {
        throw new Error(`UI 启动前退出：${result.code} ${result.stderr}`);
      }),
    ]).catch((error) => {
      throw error;
    }),
  };
}
async function submit(url, value, arrayOrigins) {
  return fetch(`${url.origin}/api/submit`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: `Bearer ${url.hash.slice(7)}`,
      Origin: url.origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value, arrayOrigins }),
  });
}
async function runWithoutUI(args) {
  const session = run(args);
  session.url.catch(() => {});
  return session.done;
}
try {
  // 模拟 dotfiles 管理的命名空间软链，真实 cc-switch 目录位于其下。
  const namespace = path.join(home, "dotfiles", ".done-coding");
  await fs.mkdir(path.join(namespace, "cc-switch"), { recursive: true });
  await fs.symlink(namespace, path.join(home, ".done-coding"));
  const original = fixture();
  await write(original);
  assert.equal((await runWithoutUI(["--meta-generate"])).code, 0);
  const session = run(["--meta-ui"]);
  const url = await session.url;
  assert.equal((await fetch(url.origin)).status, 200);
  const value = {
    ...original,
    providers: [original.providers[0], original.providers[2]].map((p) => ({
      ...p,
      alias: `${p.alias}new`,
      accounts: [
        p.accounts[0],
        p.accounts[2],
        { alias: "new", apiKey: "test-new" },
      ],
      models: [p.models[0], p.models[2], { alias: "new", name: "new-model" }],
    })),
  };
  value.providers.push({
    alias: "new",
    name: "New",
    url: "https://example.test",
    apiKey: "test-single",
    accounts: [],
    models: [{ alias: "m", name: "M" }],
  });
  const origins = {
    "/providers": [0, 2, null],
    "/providers/0/accounts": [0, 2, null],
    "/providers/1/accounts": [0, 2, null],
    "/providers/0/models": [0, 2, null],
    "/providers/1/models": [0, 2, null],
    "/providers/2/accounts": [],
    "/providers/2/models": [null],
  };
  assert.equal((await submit(url, value, origins)).status, 200);
  const result = await session.done;
  assert.equal(result.code, 0, result.stderr);
  const saved = await read(settingsPath);
  assert.deepEqual(
    saved.providers.slice(0, 2).map((p) => p.uuid),
    [uuid(1), uuid(21)],
  );
  assert.deepEqual(
    saved.providers[1].accounts.slice(0, 2).map((a) => a.uuid),
    [uuid(22), uuid(24)],
  );
  assert.deepEqual(
    saved.providers[1].models.slice(0, 2).map((m) => m.uuid),
    [uuid(25), uuid(27)],
  );
  const freshIds = [
    saved.providers[2].uuid,
    saved.providers[2].models[0].uuid,
    ...saved.providers
      .slice(0, 2)
      .flatMap((p) => [p.accounts[2].uuid, p.models[2].uuid]),
  ];
  assert.equal(new Set(freshIds).size, 6);
  for (const id of freshIds) assert.match(id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(saved.defaultProfile, original.defaultProfile);
  assert.equal(saved.unmanaged, "keep");
  const compiled = await read(profilePath);
  assert.equal(compiled.defaultProfile, "p20new-a4-m7");
  assert.equal(Object.keys(compiled.profiles).length, 19);
  assert.equal(
    compiled.profiles[compiled.defaultProfile].env.ANTHROPIC_AUTH_TOKEN,
    "test-secret-24",
  );
  assert.match(result.stdout, /移除的 profile/);
  assert.match(result.stdout, /新增的 profile/);
  assert.match(result.stdout, /外部 --meta-profile=/);
  assert.match(result.stdout, /已保存 settings，重建 19 个 profile/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-secret/);
  for (const file of [settingsPath, profilePath])
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  // 对照真正的 --meta-generate，验证 UI 重建的完整字节相同。
  const uiProfile = await fs.readFile(profilePath);
  assert.equal((await runWithoutUI(["--meta-generate"])).code, 0);
  assert.deepEqual(await fs.readFile(profilePath), uiProfile);

  await write(original);
  const failing = run(["--meta-ui"]);
  const invalid = fixture();
  invalid.providers[1].alias = invalid.providers[0].alias;
  const invalidOrigins = Object.fromEntries([
    ["/providers", [0, 1, 2]],
    ...[0, 1, 2].flatMap((i) => [
      [`/providers/${i}/accounts`, [0, 1, 2]],
      [`/providers/${i}/models`, [0, 1, 2]],
    ]),
  ]);
  assert.equal(
    (await submit(await failing.url, invalid, invalidOrigins)).status,
    500,
  );
  const failure = await failing.done;
  assert.equal(failure.code, 1);
  assert.match(failure.stderr, /校验失败/);
  assert.deepEqual(await read(settingsPath), original);

  await write({
    providers: {
      p: {
        name: "P",
        url: "u",
        apiKey: "test",
        models: [{ id: "m", name: "M" }],
      },
    },
  });
  const legacy = await runWithoutUI(["--meta-ui"]);
  assert.equal(legacy.code, 1);
  assert.match(legacy.stderr, /--meta-migrate/);
  process.stdout.write(
    "meta-ui 冒烟通过（命名空间软链）：成功退出 0；语义校验与 v1 退出 1；UUID/默认引用/600/重建字节/改名提示全部通过。\n",
  );
} finally {
  for (const child of children) {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("close", resolve));
  }
  await fs.rm(home, { recursive: true, force: true });
}
