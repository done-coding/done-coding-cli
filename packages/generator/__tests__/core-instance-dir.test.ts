/**
 * [安全硬化 实3/R3] removeEmptyInstanceDir 守卫单测（修订-3：realpath + 可疑根 + 后向兼容）。
 * fixtures 落 os.tmpdir() + afterEach 清理；homeDir 经 opts 注入，[MUST NOT] 触真实家目录。
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeEmptyInstanceDir } from "@/core/instance-dir";
import type { BatchConfig } from "@/types";

const tmpRoots: string[] = [];
const mkTmp = (): string => {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "inst-dir-")),
  );
  tmpRoots.push(dir);
  return dir;
};
afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

const cfg = (removeEmptyDir: boolean): BatchConfig => ({
  instanceDir: "x",
  removeEmptyDir,
  files: [],
});

describe("[实3] removeEmptyInstanceDir 守卫", () => {
  it("正常空子目录 → rmdir", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    removeEmptyInstanceDir(inst, cfg(true), { execDir });
    expect(fs.existsSync(inst)).toBe(false);
  });

  it("非空子目录 → 不删", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    fs.writeFileSync(path.join(inst, "f.txt"), "x");
    removeEmptyInstanceDir(inst, cfg(true), { execDir });
    expect(fs.existsSync(inst)).toBe(true);
  });

  it("execDir = 注入家目录本体 → throw（可疑根）", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    expect(() =>
      removeEmptyInstanceDir(inst, cfg(true), { execDir, homeDir: execDir }),
    ).toThrow(/家目录/);
  });

  it("execDir = 文件系统根 → throw（可疑根）", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    const fsRoot = path.parse(execDir).root;
    // instanceDir 不存在于 fsRoot 下也无妨：可疑根守卫在 existsSync 之后、但 inst 存在故进守卫
    expect(() =>
      removeEmptyInstanceDir(inst, { ...cfg(true) }, { execDir: fsRoot }),
    ).toThrow(/文件系统根/);
  });

  it("allowDangerous=true → 家目录本体也放行（空子目录被删）", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    removeEmptyInstanceDir(inst, cfg(true), {
      execDir,
      homeDir: execDir,
      allowDangerous: true,
    });
    expect(fs.existsSync(inst)).toBe(false);
  });

  it("instanceDir 经 symlink 逃逸到 execDir 外 → realpath 守卫 throw", () => {
    const execDir = mkTmp();
    const outside = mkTmp();
    const realTarget = path.join(outside, "victim");
    fs.mkdirSync(realTarget);
    // execDir/link → 外部 realTarget（字面在 execDir 内，realpath 后越界）
    const link = path.join(execDir, "link");
    fs.symlinkSync(realTarget, link);
    expect(() => removeEmptyInstanceDir(link, cfg(true), { execDir })).toThrow(
      /越界/,
    );
    expect(fs.existsSync(realTarget)).toBe(true);
  });

  it("instanceDir === execDir（realpath 后相等）→ throw", () => {
    const execDir = mkTmp();
    expect(() =>
      removeEmptyInstanceDir(execDir, cfg(true), { execDir }),
    ).toThrow(/等于 execDir/);
  });

  it("removeEmptyDir=true 缺 execDir 且目录存在 → 迁移错误 throw", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    expect(() => removeEmptyInstanceDir(inst, cfg(true))).toThrow(
      /未提供 execDir/,
    );
  });

  it("removeEmptyDir=false 缺 execDir → 静默不删（后向兼容）", () => {
    const execDir = mkTmp();
    const inst = path.join(execDir, "sub");
    fs.mkdirSync(inst);
    expect(() => removeEmptyInstanceDir(inst, cfg(false))).not.toThrow();
    expect(fs.existsSync(inst)).toBe(true);
  });

  it("removeEmptyDir=true 但目录不存在 → 静默 return（不抛缺 execDir）", () => {
    const inst = path.join(mkTmp(), "ghost");
    expect(() => removeEmptyInstanceDir(inst, cfg(true))).not.toThrow();
  });
});
