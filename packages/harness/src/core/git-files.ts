import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compareCodePoint } from "./fs-entries";

/** 代码类闸只认 git 项目根（cwd-only）：MODULES.md 里的路径都相对仓根 */
export const assertGitRoot = (projectRoot: string): void => {
  let gitRoot = "";
  try {
    gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(
      `代码类检查须在 git 项目根执行：${projectRoot} 不是 git 仓`,
    );
  }
  if (fs.realpathSync(gitRoot) !== fs.realpathSync(projectRoot)) {
    throw new Error(`代码类检查须在 git 项目根执行（当前 git 根 ${gitRoot}）`);
  }
};

/** git 跟踪的文件（仓根相对、`/` 分隔、码点序） */
export const listTracked = (projectRoot: string): string[] =>
  execFileSync("git", ["ls-files", "--cached", "-z"], {
    cwd: projectRoot,
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean)
    .sort(compareCodePoint);

/** 未跟踪且未被忽略的文件：新建还没 `git add` 的（仓根相对、`/` 分隔、码点序） */
export const listUntracked = (projectRoot: string): string[] =>
  execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: projectRoot,
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean)
    .sort(compareCodePoint);

/** 代码类闸的文件面 */
export interface WorkingFiles {
  /** 跟踪文件 + 未跟踪未忽略的新文件（码点序） */
  files: string[];
  /** 其中未跟踪的新文件 */
  untracked: string[];
}

/**
 * 代码类闸查的文件：跟踪文件加上未跟踪的新文件。
 * ---
 * 改代码时最常见的是「新文件还没 add」，只取跟踪文件会让三闸在新文件上恒绿；
 * 被 .gitignore 忽略的不算。
 */
export const listWorkingFiles = (projectRoot: string): WorkingFiles => {
  const untracked = listUntracked(projectRoot);
  return {
    files: [...new Set([...listTracked(projectRoot), ...untracked])].sort(
      compareCodePoint,
    ),
    untracked,
  };
};

/** 读跟踪文件的工作树内容；不存在 / 非普通文件 / 含 NUL（二进制）返回 undefined */
export const readTrackedText = (
  projectRoot: string,
  file: string,
): string | undefined => {
  const abs = path.join(projectRoot, file);
  try {
    const stat = fs.lstatSync(abs);
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) return undefined;
    const buffer = fs.readFileSync(abs);
    if (buffer.includes(0)) return undefined;
    return buffer.toString("utf-8");
  } catch {
    return undefined;
  }
};
