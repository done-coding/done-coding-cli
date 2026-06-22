/**
 * 渲染适配 + throw-only 碎片读取（design §5 / **§14 D-H6 / D-M2**）。
 *
 *  - createRender(vars) = lodash.template 封装，注入 gen helper `_.` 命名空间
 *    （复用 createEnvHelpers，零新增 lodash 子包，D-H6）。
 *  - readFragment：throw-only（[MUST NOT] process.exit）+ fragmentRoot 越界 throw +
 *    markdown fence 单层剥离（正则同 cli-template get-data.ts）。
 *    [MUST NOT] 直接调 getData（它 process.exit 且无越界防护，D-H6）。
 *  - 复用 cli-utils package-json 读写壳 getPackageJson（仅 IO 壳，D-M2），
 *    [MUST NOT] 复用 addPackageConfig 的 lodash.merge。
 */
import fs from "node:fs";
import path from "node:path";
import _template from "lodash.template";
import { createEnvHelpers } from "@/core/env-context";
// D-M2：复用 cli-utils package-json IO 壳（非 packages/config），不复用其合并语义
import { getPackageJson } from "@done-coding/cli-utils";

export { getPackageJson };

/**
 * 构造渲染函数：lodash.template(tpl)(vars + { _: helpers })。
 * helper 命名空间复用 gen createEnvHelpers（camelCase/kebabCase/upperFirst/lowerFirst/pascalCase）。
 */
export const createRender = (
  vars: Record<string, unknown>,
): ((tpl: string) => string) => {
  const data = { ...vars, _: createEnvHelpers() };
  return (tpl: string): string => _template(tpl)(data);
};

/** markdown 单层 code fence 剥离正则（与 cli-template get-data.ts 同语义） */
const FENCE_RE = /^\s*```[a-zA-Z0-9]+\s*[\r\n]+([\s\S]+?)```\s*$/;

/** child 是否在 parent 内（含等于自身，复刻 gen batch-discovery isInside 范式） */
const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/** 解析并越界守卫碎片绝对路径（throw-only，[MUST NOT] process.exit）。 */
const resolveFragmentAbs = (fragmentRoot: string, rel: string): string => {
  const root = path.resolve(fragmentRoot);
  const resolved = path.resolve(root, rel);
  if (!isInside(root, resolved)) {
    throw new Error(
      `碎片路径越界 fragmentRoot：${JSON.stringify(rel)} 解析为 ${resolved}，不在 ${root} 内`,
    );
  }
  return resolved;
};

/**
 * throw-only 文本碎片读取（D-H6）。
 *  - 越界 → throw；不存在 fs throw。
 *  - dealMarkdown && .md → 剥单层 code fence。
 * [MUST NOT] process.exit。
 */
export const readFragment = (
  fragmentRoot: string,
  rel: string,
  opts?: { dealMarkdown?: boolean },
): string => {
  const resolved = resolveFragmentAbs(fragmentRoot, rel);
  const content = fs.readFileSync(resolved, "utf-8");
  if (opts?.dealMarkdown && resolved.endsWith(".md")) {
    return content.replace(FENCE_RE, "$1");
  }
  return content;
};

/**
 * throw-only 原始二进制碎片读取（M1）：返回 Buffer，不解码不渲染。
 * 二进制文件碎片（图片等）走此路逐字节保留，[MUST NOT] utf-8 化。
 */
export const readFragmentBuffer = (
  fragmentRoot: string,
  rel: string,
): Buffer => {
  const resolved = resolveFragmentAbs(fragmentRoot, rel);
  return fs.readFileSync(resolved);
};

/**
 * 启发式判定 Buffer 是否二进制（M1）：含 NUL 字节即视为二进制。
 * 文本（含 UTF-8 多字节）不含 NUL；图片/字体/压缩包等含 NUL。简单稳健，零依赖。
 */
export const isBinaryBuffer = (buf: Buffer): boolean => buf.includes(0);
