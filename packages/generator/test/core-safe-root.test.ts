/**
 * [安全硬化 实1/R1] assertCwdNotSuspiciousRoot 公共可疑根守卫单测。
 * 纯函数（只读目录值），homeDir 注入避免触真实家目录。
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertCwdNotSuspiciousRoot } from "@/core/safe-root";

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "safe-root-")),
  );
  tmpRoots.push(dir);
  return dir;
};
afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

describe("[实1] assertCwdNotSuspiciousRoot", () => {
  it("dir = 注入家目录本体 → throw", () => {
    const home = mkTmp();
    expect(() => assertCwdNotSuspiciousRoot(home, { homeDir: home })).toThrow(
      /家目录本体/,
    );
  });

  it("dir = 文件系统根 → throw", () => {
    const root = path.parse(process.cwd()).root;
    expect(() => assertCwdNotSuspiciousRoot(root)).toThrow(/文件系统根/);
  });

  it("dir = 家目录子目录（正常项目）→ 通过", () => {
    const home = mkTmp();
    const project = path.join(home, "projects", "foo");
    expect(() =>
      assertCwdNotSuspiciousRoot(project, { homeDir: home }),
    ).not.toThrow();
  });

  it("dir = 普通临时目录 → 通过", () => {
    const dir = mkTmp();
    expect(() => assertCwdNotSuspiciousRoot(dir)).not.toThrow();
  });

  it("allowDangerous=true → 即使家目录本体也跳过", () => {
    const home = mkTmp();
    expect(() =>
      assertCwdNotSuspiciousRoot(home, { homeDir: home, allowDangerous: true }),
    ).not.toThrow();
  });

  it("缺省 homeDir 用 os.homedir()（真实家目录命中 throw，不触磁盘写）", () => {
    expect(() => assertCwdNotSuspiciousRoot(os.homedir())).toThrow(
      /家目录本体/,
    );
  });
});
