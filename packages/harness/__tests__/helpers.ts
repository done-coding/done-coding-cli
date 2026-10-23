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
