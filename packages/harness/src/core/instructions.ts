import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compareCodePoint } from "./fs-entries";

export const DEFAULT_INSTRUCTION_BUDGET = {
  root: 16384,
  nested: 8192,
  chain: 32768,
};

export interface InstructionsConfig {
  budget?: Partial<typeof DEFAULT_INSTRUCTION_BUDGET>;
  /** Git glob pathspec，相对仓根匹配。 */
  exclude?: string[];
  gate?: boolean;
}

export interface InstructionFile {
  file: string;
  bytes: number;
}

export interface InstructionsResult {
  budget: typeof DEFAULT_INSTRUCTION_BUDGET;
  files: InstructionFile[];
  errors: string[];
}

/** 拒绝会让预算失效的配置。 */
const validateConfig = (
  config: InstructionsConfig,
  budget: typeof DEFAULT_INSTRUCTION_BUDGET,
): void => {
  for (const [key, value] of Object.entries(budget)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`instructions.budget.${key} 须为非负安全整数`);
    }
  }
  if (
    config.exclude !== undefined &&
    (!Array.isArray(config.exclude) ||
      config.exclude.some((glob) => typeof glob !== "string" || !glob))
  ) {
    throw new Error("instructions.exclude 须为非空 glob 字符串数组");
  }
};

/** 只读跟踪文件的工作树内容；Git 根必须就是调用目录，不向上寻找项目。 */
export const runInstructions = (
  projectRoot: string,
  config: InstructionsConfig = {},
): InstructionsResult => {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: projectRoot, encoding: "utf-8" });
  const gitRoot = git(["rev-parse", "--show-toplevel"]).trim();
  if (fs.realpathSync(gitRoot) !== fs.realpathSync(projectRoot)) {
    throw new Error("instructions 须在 git 项目根执行（cwd-only）");
  }
  const budget = { ...DEFAULT_INSTRUCTION_BUDGET, ...config.budget };
  validateConfig(config, budget);
  const tracked = new Set(
    git([
      "ls-files",
      "--cached",
      "-z",
      "--",
      ":(glob)**/AGENTS.md",
      ":(glob)**/CLAUDE.md",
      ...(config.exclude ?? []).map((glob) => `:(exclude,glob)${glob}`),
    ])
      .split("\0")
      .filter(Boolean),
  );
  const errors: string[] = [];
  const read = (file: string): Buffer | undefined => {
    try {
      // lstat 拒绝软链，避免读取仓外正文；失踪的跟踪文件也须报错。
      if (!fs.lstatSync(path.join(projectRoot, file)).isFile()) {
        errors.push(`${file}：须为普通文件（非软链）`);
        return undefined;
      }
      const real = fs.realpathSync(path.join(projectRoot, file));
      const relative = path.relative(fs.realpathSync(projectRoot), real);
      if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      ) {
        errors.push(`${file}：真实路径逃出项目根`);
        return undefined;
      }
      return fs.readFileSync(real);
    } catch (err) {
      errors.push(`${file}：无法读取（${String(err)}）`);
      return undefined;
    }
  };
  const files: InstructionFile[] = [];
  for (const file of [...tracked].sort(compareCodePoint)) {
    const content = read(file);
    if (content === undefined) continue;
    if (path.posix.basename(file) === "CLAUDE.md") {
      const lines = content
        .toString("utf-8")
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
      const agents = path.posix.join(path.posix.dirname(file), "AGENTS.md");
      if (tracked.has(agents)) {
        if (lines[0] !== "@AGENTS.md") {
          errors.push(`${file}：首个非空行须为 @AGENTS.md`);
        }
      } else if (lines.length !== 1 || !/^@\S+$/u.test(lines[0])) {
        errors.push(`${file}：正文仍在 CLAUDE.md（无同级 AGENTS.md）`);
      }
      continue;
    }
    const bytes = content.length;
    files.push({ file, bytes });
    const limit = file === "AGENTS.md" ? budget.root : budget.nested;
    if (bytes > limit) {
      errors.push(
        `${file}：实际 ${bytes} B，预算 ${limit} B，超出 ${bytes - limit} B`,
      );
    }
    const claude = path.posix.join(path.posix.dirname(file), "CLAUDE.md");
    if (!tracked.has(claude))
      errors.push(`${claude}：缺少同级跟踪的普通兼容入口`);
  }
  for (const target of files) {
    const chain = files
      .filter(
        ({ file }) =>
          file === "AGENTS.md" ||
          file === target.file ||
          target.file.startsWith(`${path.posix.dirname(file)}/`),
      )
      .sort((a, b) => a.file.split("/").length - b.file.split("/").length);
    const total = chain.reduce((sum, item) => sum + item.bytes, 0);
    if (total > budget.chain) {
      const largest = chain.reduce((a, b) => (a.bytes >= b.bytes ? a : b));
      errors.push(
        `${target.file} 链路：实际 ${total} B，预算 ${budget.chain} B，超出 ${total - budget.chain} B；沿途 ${chain.map((item) => `${item.file}=${item.bytes} B`).join(" → ")}；最大贡献者 ${largest.file}=${largest.bytes} B`,
      );
    }
  }
  return { budget, files, errors };
};
