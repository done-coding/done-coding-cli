/**
 * post-render 格式化钩子（recipe.format = "prettier"，opt-in；codegen-unified 验证发现 P1）。
 *
 * 背景：生成物折行依赖内容长度，模板逼近 prettier 输出不可行；build 后再手工格式化会使
 * tree check（clean regenerate 逐字节比对）恒报格式漂移。故格式化 [MUST] 收进生成管道：
 * 在 **VFS 层、flush/manifest 之前**逐文件执行——runBuild / runDiff（check 复用 diff）
 * 经同一变换，格式化产物即漂移闸基线。
 *
 * 决策：
 *  - 用**目标项目自己的 prettier**（`<cwd>/node_modules/.bin/prettier`）：版本与配置随
 *    目标仓（--stdin-filepath 按产物真实路径解析仓内配置），生成结果与仓内 CI 口径一致；
 *    [MUST NOT] 由本包自带 prettier（版本漂移 = 跨机漂移闸假阳性）。
 *  - 逐文件 `--stdin-filepath` 同步 spawn（KISS：模块生成单配方文件数少；慢了再批量优化）。
 *  - 无 parser 的文件（二进制/未知扩展名）静默跳过；**其它格式化错误 fail-loud**——
 *    prettier 解析失败 ≈ 生成物语法损坏，格式化兼作语法闸。
 *  - 仅作用配方产物 VFS；tree 注入（textPatch 改既有项目文件）是外科手术补丁，
 *    [MUST NOT] 重排用户文件，不经此钩子。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Recipe, Vfs } from "./types";

/** 格式化写入的 provenance opId（非真实 op；仅标记该节点内容经过格式化变换）。 */
export const FORMAT_OP_ID = "__format__";

/** prettier 报「无法推断 parser」的特征串（跳过依据；其它错误上抛）。 */
const NO_PARSER_RE = /no parser could be inferred/i;

/**
 * 解析目标项目的 prettier 可执行文件；找不到 fail-loud
 * （配方声明了 format 但目标项目没有 prettier = 配置错误，[MUST NOT] 静默不格式化）。
 */
export const resolvePrettierBin = (cwd: string): string => {
  const bin = path.join(cwd, "node_modules", ".bin", "prettier");
  if (!fs.existsSync(bin)) {
    throw new Error(
      `配方声明 format:"prettier"，但目标项目未安装 prettier（未找到 ${bin}）。` +
        `请在目标项目安装 prettier，或去掉配方 format 字段。`,
    );
  }
  return bin;
};

export interface FormatVfsOptions {
  /** 工作目录（prettier 解析基准 + output 绝对化基准） */
  cwd: string;
  /** 格式化器可执行文件覆盖（测试注入 stub；缺省 = resolvePrettierBin(cwd)） */
  formatterBin?: string;
}

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
  const bin = opts.formatterBin ?? resolvePrettierBin(opts.cwd);
  const outputRoot = path.resolve(opts.cwd, recipe.output);
  for (const rel of vfs.paths()) {
    const node = vfs.get(rel);
    if (!node || node.kind !== "file" || !node.content) continue;
    // 产物真实落点路径喂 --stdin-filepath：prettier 据此推断 parser + 解析仓内配置
    const abs = path.join(outputRoot, rel);
    let formatted: Buffer;
    try {
      formatted = execFileSync(bin, ["--stdin-filepath", abs], {
        input: node.content,
        maxBuffer: 64 * 1024 * 1024,
        // stderr 收进错误对象（跳过判定用），不透传污染宿主输出（MCP stdio 场景尤其）
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      const stderr =
        err && typeof err === "object" && "stderr" in err
          ? String((err as { stderr: unknown }).stderr ?? "")
          : "";
      if (NO_PARSER_RE.test(stderr)) continue; // 二进制/未知类型：跳过
      throw new Error(
        `格式化失败（prettier，生成物疑似语法损坏）：${rel}\n  ${
          stderr.trim() || (err instanceof Error ? err.message : String(err))
        }`,
      );
    }
    // setFile 缺省沿用既有节点 mode（vfs 契约），无需显式透传
    vfs.setFile(rel, formatted, FORMAT_OP_ID);
  }
};
