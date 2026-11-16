import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 在临时目录建一个治理目录夹具：`files` 为 相对路径 → 内容 */
export const makeGovernance = (files: Record<string, string>): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-gov-"));
  for (const dir of ["backlog", "dropped", "schedule", "archive"]) {
    fs.mkdirSync(path.join(root, dir));
  }
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf-8");
  }
  return root;
};

/** 条目 frontmatter */
export const entry = (fields: Record<string, string>, body = ""): string =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\n---\n${body}`;

/** 删除临时目录 */
export const cleanup = (...dirs: string[]): void => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
};

/** 临时 git 仓夹具：写文件并 `git add`（代码类闸只认跟踪文件） */
export const makeRepo = (files: Record<string, string>): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-repo-"));
  writeFiles(root, files);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
};

/** 覆盖 / 新增文件并重新 `git add`；内容为 null 即删除 */
export const updateRepo = (
  root: string,
  files: Record<string, string | null>,
): void => {
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) fs.rmSync(path.join(root, rel), { force: true });
  }
  writeFiles(
    root,
    Object.fromEntries(
      Object.entries(files).filter(
        (pair): pair is [string, string] => pair[1] !== null,
      ),
    ),
  );
  execFileSync("git", ["add", "-A"], { cwd: root });
};

const writeFiles = (root: string, files: Record<string, string>): void => {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf-8");
  }
};
