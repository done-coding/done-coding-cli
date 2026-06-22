/**
 * <实例目录解析 + removeEmptyDir>（design §4.4，R4①④ + 安全收尾硬化批 修订-3）。
 *
 *  - 按 config.instanceDir 用 envData 渲染出实例目录绝对路径（落 execDir=safeCwd）。
 *  - removeEmptyDir（默认 false）：remove 后若实例子目录为空则 rmdir（component 预设设 true，
 *    复刻 component remove.ts:65 rmdirSync）。
 *  - 修订-3（吸收 H2+M1）：rmdir 前 realpath 双解防 symlink 逃逸 + 可疑根守卫 + execDir 越界守卫；
 *    第三参可选（不破已导出 API），removeEmptyDir=true 缺 execDir 才 fail-loud 迁移错误。
 */
import fs from "node:fs";
import path from "node:path";
import type { BatchConfig, EnvContext } from "@/types";
import { assertCwdNotSuspiciousRoot } from "@/core/safe-root";
import _template from "lodash.template";

/** child 是否在 parent 内（含等于自身，与 engine 字面一致，D5 不抽公共） */
const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/** 渲染实例目录绝对路径（落 execDir） */
export const resolveInstanceDir = (
  config: BatchConfig,
  env: EnvContext,
): string => {
  const rendered = _template(config.instanceDir)(env);
  // instanceDir 可绝对（含 ${execDir}）可相对（按 execDir）；统一 resolve 到 execDir
  return path.resolve(env.execDir, rendered);
};

/** removeEmptyInstanceDir 选项（修订-3：第三参可选，保后向兼容） */
export interface RemoveEmptyInstanceDirOpts {
  /** 执行根（守卫基准）；removeEmptyDir=true 时 [MUST] 提供，缺省 → fail-loud 迁移错误 */
  execDir?: string;
  /** 显式逃逸可疑根守卫（默认 false） */
  allowDangerous?: boolean;
  /** 注入家目录（缺省 os.homedir()），便于单测 */
  homeDir?: string;
}

/**
 * removeEmptyDir：实例子目录为空则删除（默认 false）。
 * 修订-3 守卫链（rmdir 前，fail-loud）：
 *  ① !removeEmptyDir → return；② !existsSync(instanceDir) → return；
 *  ③ removeEmptyDir=true 且 opts?.execDir===undefined → throw 迁移错误（后向兼容：
 *     removeEmptyDir=false 缺 execDir 在 ① 已 return，零影响）；
 *  ④ 可疑根守卫（家目录本体 / 文件系统根）；
 *  ⑤ realpath 双解（失败抛，不回落字面放行）；
 *  ⑥ !isInside(realExec, realInst) || realInst===realExec → throw 越界；
 *  ⑦ readdir 空则 rmdirSync。
 */
export const removeEmptyInstanceDir = (
  instanceDir: string,
  config: BatchConfig,
  opts?: RemoveEmptyInstanceDirOpts,
): void => {
  if (!config.removeEmptyDir) {
    return;
  }
  if (!fs.existsSync(instanceDir)) {
    return;
  }
  if (opts?.execDir === undefined) {
    throw new Error(
      `removeEmptyInstanceDir：removeEmptyDir=true 但未提供 execDir` +
        `（安全硬化迁移：调用方须传 opts.execDir）`,
    );
  }
  assertCwdNotSuspiciousRoot(opts.execDir, {
    ...(opts.allowDangerous !== undefined
      ? { allowDangerous: opts.allowDangerous }
      : {}),
    ...(opts.homeDir !== undefined ? { homeDir: opts.homeDir } : {}),
  });
  // H2：realpath 双解，防 symlink 逃逸（失败 → 抛，不回落字面放行）
  const realExec = fs.realpathSync(opts.execDir);
  const realInst = fs.realpathSync(instanceDir);
  if (!isInside(realExec, realInst) || realInst === realExec) {
    throw new Error(
      `instanceDir 经 realpath 解析越界 execDir 或等于 execDir，拒绝 rmdir：${realInst}`,
    );
  }
  const remaining = fs.readdirSync(instanceDir);
  if (remaining.length === 0) {
    fs.rmdirSync(instanceDir);
  }
};
