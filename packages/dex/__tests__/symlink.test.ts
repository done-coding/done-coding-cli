import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * 软链初始化测试：~/.pi → ~/.done-coding/dex（幂等）。
 * os.homedir() 有缓存（libuv/模块级），改 process.env.HOME 不生效——
 * 用 vi.mock("node:os") 注入 homedir 到 tmp 沙盒，动态 import 让模块常量在注入后求值。
 */

const h = vi.hoisted(() => ({ tmpHome: "" as string }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => h.tmpHome };
});

let mod: typeof import("@/init/symlink");

beforeAll(async () => {
  h.tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "dc-dex-home-"));
  mod = await import("@/init/symlink");
});

afterAll(() => {
  fs.rmSync(h.tmpHome, { recursive: true, force: true });
});

describe("initSymlink", () => {
  it("创建 ~/.pi → ~/.done-coding/dex 软链 + 真实目录", () => {
    mod.initSymlink();
    const target = fs.readlinkSync(path.join(h.tmpHome, ".pi"));
    expect(path.resolve(target)).toBe(
      path.join(h.tmpHome, ".done-coding", "dex"),
    );
    expect(fs.existsSync(path.join(h.tmpHome, ".done-coding", "dex"))).toBe(
      true,
    );
  });

  it("幂等：重复调用不报错、不改变目标", () => {
    expect(() => mod.initSymlink()).not.toThrow();
    const target = fs.readlinkSync(path.join(h.tmpHome, ".pi"));
    expect(path.resolve(target)).toBe(
      path.join(h.tmpHome, ".done-coding", "dex"),
    );
  });
});
