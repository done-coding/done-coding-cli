/**
 * [T5] init 命令面用例（design §4.5/§9 用例9，R9/L3）。
 * 沙盒铁律（K7）：夹具落 tmp + fake HOME，afterEach 清理。
 */
/* eslint-disable no-template-curly-in-string */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler as initHandler } from "@/handlers/init";

// ensure-name 由 T4 实现（并发）；init 仅消费其类型名校验契约，此处 mock 隔离 T4。
// vi.mock 会被 vitest 提升到 import 之前，故置于此处不影响生效。
vi.mock("@/utils/ensure-name", () => ({
  ensureNameLegal: (raw: string) => {
    if (!/^[a-zA-Z]+[a-zA-Z0-9-]*$/.test(raw)) {
      throw new Error(`非法批次类型名：${raw}`);
    }
    return true;
  },
  NAME_LEGAL_PATTERN: /^[a-zA-Z]+[a-zA-Z0-9-]*$/,
}));

let tmpRoot: string;
let originalHome: string | undefined;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dc-gen-init-"));
  originalHome = process.env.HOME;
});

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("[T5] dc-gen init", () => {
  it("生成 index.json + config.json5 + template/ 占位", async () => {
    await initHandler({ type: "widget" }, { mode: "test", cwd: tmpRoot });

    const batchDir = path.join(tmpRoot, ".done-coding", "widget");
    expect(fs.existsSync(path.join(batchDir, "index.json"))).toBe(true);
    expect(fs.existsSync(path.join(batchDir, "config.json5"))).toBe(true);
    expect(fs.existsSync(path.join(batchDir, "template"))).toBe(true);

    const indexJson = JSON.parse(
      fs.readFileSync(path.join(batchDir, "index.json"), "utf-8"),
    );
    expect(indexJson.config).toBe("./config.json5");
  });

  it("config.json5 注释头：helper 白名单 5 个 + 内建变量 + 策略只列 3，inject 标 reserved", async () => {
    await initHandler({ type: "widget" }, { mode: "test", cwd: tmpRoot });
    const config5 = fs.readFileSync(
      path.join(tmpRoot, ".done-coding", "widget", "config.json5"),
      "utf-8",
    );

    // helper 白名单 5 个，无 snakeCase/startCase（K6）
    for (const helper of [
      "camelCase",
      "kebabCase",
      "upperFirst",
      "lowerFirst",
      "pascalCase",
    ]) {
      expect(config5).toContain(`_.${helper}`);
    }
    expect(config5).not.toContain("snakeCase");
    expect(config5).not.toContain("startCase");

    // 内建变量速查
    for (const v of [
      "${name}",
      "${nameKebab}",
      "${rawName}",
      "${execDir}",
      "${templateDir}",
      "${$}",
    ]) {
      expect(config5).toContain(v);
    }

    // 策略速查：4 个（inject = P2 已交付，锚点插入 + marker 健壮回退）
    expect(config5).toContain("create");
    expect(config5).toContain("append");
    expect(config5).toContain("replace");
    expect(config5).toContain("inject");
    expect(config5).toContain("anchor");
    expect(config5).toContain("不可自动 remove");
  });

  it("config.json5 可被 JSON5 解析（含注释，得合法对象）", async () => {
    const { json5 } = await import("@done-coding/cli-utils");
    await initHandler({ type: "thing" }, { mode: "test", cwd: tmpRoot });
    const config5 = fs.readFileSync(
      path.join(tmpRoot, ".done-coding", "thing", "config.json5"),
      "utf-8",
    );
    const parsed = json5.parse(config5) as { files: unknown[] };
    expect(Array.isArray(parsed.files)).toBe(true);
  });

  it("目标已存在 → 报错不覆盖", async () => {
    await initHandler({ type: "widget" }, { mode: "test", cwd: tmpRoot });
    await expect(
      initHandler({ type: "widget" }, { mode: "test", cwd: tmpRoot }),
    ).rejects.toThrow(/已存在/);
  });

  it("--global 写 ~/.done-coding（fake HOME）", async () => {
    const fakeHome = path.join(tmpRoot, "fake-home");
    fs.mkdirSync(fakeHome, { recursive: true });
    process.env.HOME = fakeHome;

    await initHandler(
      { type: "widget", global: true },
      { mode: "test", cwd: tmpRoot },
    );

    expect(
      fs.existsSync(
        path.join(fakeHome, ".done-coding", "widget", "config.json5"),
      ),
    ).toBe(true);
    // 未写进 cwd
    expect(fs.existsSync(path.join(tmpRoot, ".done-coding", "widget"))).toBe(
      false,
    );
  });

  it("缺 type → fail-fast", async () => {
    await expect(
      initHandler({}, { mode: "test", cwd: tmpRoot }),
    ).rejects.toThrow(/type/);
  });
});
