/**
 * post-render 格式化钩子（recipe.format = "prettier" | "ruff"，opt-in；codegen-unified 验证发现 P1）。
 *
 * 背景：生成物折行依赖内容长度，模板逼近 prettier 输出不可行；build 后再手工格式化会使
 * tree check（clean regenerate 逐字节比对）恒报格式漂移。故格式化 [MUST] 收进生成管道：
 * 在 **VFS 层、flush/manifest 之前**逐文件执行——runBuild / runDiff（check 复用 diff）
 * 经同一变换，格式化产物即漂移闸基线。
 *
 * 决策：
 *  - 用**目标项目自己的 prettier**：从产物目录（output）逐级向上找到 cwd 为止，取最近的
 *    `node_modules/.bin/prettier`（monorepo 成员自装、仓根未装也能命中；issue kuoimm）；
 *    配置同理随产物真实路径就近解析（--stdin-filepath），生成结果与该成员 CI 口径一致；
 *    不越出 cwd 向上找（不吃仓外/全局 prettier）；
 *    [MUST NOT] 由本包自带 prettier（版本漂移 = 跨机漂移闸假阳性）。
 *  - 逐文件 `--stdin-filepath` 同步 spawn（KISS：模块生成单配方文件数少；慢了再批量优化）。
 *  - 无 parser 的文件（二进制/未知扩展名）静默跳过；**其它格式化错误 fail-loud**——
 *    prettier 解析失败 ≈ 生成物语法损坏，格式化兼作语法闸。
 *  - 仅作用配方产物 VFS；tree 注入（textPatch 改既有项目文件）是外科手术补丁，
 *    [MUST NOT] 重排用户文件，不经此钩子。
 *  - `"ruff"`（issue cjunp5，Python 产物）：只格式化 `*.py` / `*.pyi`，其余文件不动；用**目标项目
 *    自己的 ruff**——自 output 逐级向上至 cwd，取最近的 `.venv` / `venv` 里的 ruff，在该项目目录下
 *    `ruff format --stdin-filename <产物路径> -`（配置随产物路径就近取 pyproject.toml）；找不到
 *    fail-loud。不用全局 ruff，也不借 `uv run` 现场建环境（会改写目标项目的 .venv）。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isInside } from "@/core/path-safe";
import type { Recipe, Vfs } from "./types";

/** 格式化写入的 provenance opId（非真实 op；仅标记该节点内容经过格式化变换）。 */
export const FORMAT_OP_ID = "__format__";

/** prettier 报「无法推断 parser」的特征串（跳过依据；其它错误上抛）。 */
const NO_PARSER_RE = /no parser could be inferred/i;

/**
 * 解析目标项目的 prettier 可执行文件：自 fromDir（缺省 = cwd）逐级向上至 cwd，取最近的
 * `node_modules/.bin/prettier`；fromDir 不在 cwd 内时只查 cwd。找不到 fail-loud
 * （配方声明了 format 但目标项目没有 prettier = 配置错误，[MUST NOT] 静默不格式化）。
 */
export const resolvePrettierBin = (
  cwd: string,
  fromDir: string = cwd,
): string => {
  const root = path.resolve(cwd);
  let dir = path.resolve(fromDir);
  if (!isInside(root, dir)) dir = root;
  const tried: string[] = [];
  for (;;) {
    const bin = path.join(dir, "node_modules", ".bin", "prettier");
    if (fs.existsSync(bin)) return bin;
    tried.push(bin);
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  throw new Error(
    `配方声明 format:"prettier"，但目标项目未安装 prettier（已查找 ${tried.join("、")}）。` +
      `请在产物所属项目（或其上层直至项目根）安装 prettier，或去掉配方 format 字段。`,
  );
};

/** 目标项目的 ruff：可执行文件 + 运行目录（venv 所在目录，配置就近解析的基准） */
export interface RuffCommand {
  bin: string;
  cwd: string;
}

const RUFF_IN_VENV = [
  [".venv", "bin", "ruff"],
  ["venv", "bin", "ruff"],
  [".venv", "Scripts", "ruff.exe"],
  ["venv", "Scripts", "ruff.exe"],
];

/**
 * 解析目标项目的 ruff：自 fromDir（缺省 = cwd）逐级向上至 cwd，取最近的 venv 里的 ruff；
 * fromDir 不在 cwd 内时只查 cwd。找不到 fail-loud（配方声明了 format:"ruff" 但项目没装 = 配置错误）。
 */
export const resolveRuffCommand = (
  cwd: string,
  fromDir: string = cwd,
): RuffCommand => {
  const root = path.resolve(cwd);
  let dir = path.resolve(fromDir);
  if (!isInside(root, dir)) dir = root;
  const tried: string[] = [];
  for (;;) {
    for (const segments of RUFF_IN_VENV) {
      const bin = path.join(dir, ...segments);
      if (fs.existsSync(bin)) return { bin, cwd: dir };
      tried.push(bin);
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  throw new Error(
    `配方声明 format:"ruff"，但目标项目的虚拟环境里没有 ruff（已查找 ${tried.join("、")}）。` +
      `请在产物所属的 Python 项目里装好开发依赖（如 uv sync），或去掉配方 format 字段。`,
  );
};

export interface FormatVfsOptions {
  /** 工作目录（prettier 解析基准 + output 绝对化基准） */
  cwd: string;
  /** 格式化器可执行文件覆盖（测试注入 stub；缺省 = 自 output 目录就近解析，见 resolvePrettierBin / resolveRuffCommand） */
  formatterBin?: string;
}

/** 一种格式化器：哪些文件归它管 + 单文件变换（返回 undefined = 跳过） */
interface Formatter {
  applies: (rel: string) => boolean;
  run: (content: Buffer, abs: string, rel: string) => Buffer | undefined;
}

/** 取子进程 stderr（错误信息与跳过判定用） */
const stderrOf = (err: unknown): string =>
  err && typeof err === "object" && "stderr" in err
    ? String((err as { stderr: unknown }).stderr ?? "")
    : "";

const failFormat = (tool: string, rel: string, err: unknown): Error =>
  new Error(
    `格式化失败（${tool}，生成物疑似语法损坏）：${rel}\n  ${
      stderrOf(err).trim() || (err instanceof Error ? err.message : String(err))
    }`,
  );

const prettierFormatter = (bin: string): Formatter => ({
  applies: () => true,
  run: (content, abs, rel) => {
    try {
      // 产物真实落点路径喂 --stdin-filepath：prettier 据此推断 parser + 解析仓内配置
      return execFileSync(bin, ["--stdin-filepath", abs], {
        input: content,
        maxBuffer: 64 * 1024 * 1024,
        // stderr 收进错误对象（跳过判定用），不透传污染宿主输出（MCP stdio 场景尤其）
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      if (NO_PARSER_RE.test(stderrOf(err))) return undefined; // 二进制/未知类型：跳过
      throw failFormat("prettier", rel, err);
    }
  },
});

const ruffFormatter = (command: RuffCommand): Formatter => ({
  applies: (rel) => /\.pyi?$/.test(rel),
  run: (content, abs, rel) => {
    try {
      return execFileSync(
        command.bin,
        ["format", "--stdin-filename", abs, "-"],
        {
          cwd: command.cwd,
          input: content,
          maxBuffer: 64 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (err) {
      throw failFormat("ruff", rel, err);
    }
  },
});

/** 按配方声明取格式化器（formatterBin 覆盖时以 outputRoot 为运行目录） */
const createFormatter = (
  recipe: Recipe,
  outputRoot: string,
  opts: FormatVfsOptions,
): Formatter =>
  recipe.format === "ruff"
    ? ruffFormatter(
        opts.formatterBin
          ? { bin: opts.formatterBin, cwd: path.resolve(opts.cwd) }
          : resolveRuffCommand(opts.cwd, outputRoot),
      )
    : prettierFormatter(
        opts.formatterBin ?? resolvePrettierBin(opts.cwd, outputRoot),
      );

/**
 * 按 recipe.format 对 VFS 文件节点逐一格式化（原位覆写内容，保留 mode）。
 * 无 format 声明 = no-op。[MUST] 在 flush / writeManifest 前调用。
 */
export const formatVfs = (
  recipe: Recipe,
  vfs: Vfs,
  opts: FormatVfsOptions,
): void => {
  if (recipe.format === undefined) return;
  const outputRoot = path.resolve(opts.cwd, recipe.output);
  const formatter = createFormatter(recipe, outputRoot, opts);
  for (const rel of vfs.paths()) {
    const node = vfs.get(rel);
    if (!node || node.kind !== "file" || !node.content) continue;
    if (!formatter.applies(rel)) continue;
    const formatted = formatter.run(
      node.content,
      path.join(outputRoot, rel),
      rel,
    );
    // setFile 缺省沿用既有节点 mode（vfs 契约），无需显式透传
    if (formatted) vfs.setFile(rel, formatted, FORMAT_OP_ID);
  }
};
