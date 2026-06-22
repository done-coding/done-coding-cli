/**
 * 公共可疑根守卫（安全收尾硬化批 修订-1，R1）。
 *
 * destructive 入口（assemble runBuild flush=整目录替换+孤儿删除 / gen removeEmptyInstanceDir=rmdir）
 * 在 cwd/execDir 解析后调用本守卫：若该目录恰好 = 家目录本体 或 = 文件系统根（盘符根），
 * 则 fail-loud 拒绝运行——这是 safeCwd() 防崩兜底会回落到的两个危险点，destructive 操作落此会
 * 作用在用户家目录 / 根下真实目录。
 *
 *  - 判据**只认目录本体** = homedir 或 = 根，[MUST NOT] 扩到「homedir 子目录」（否则正常的
 *    ~/projects/foo 被误杀）。
 *  - allowDangerous===true 显式逃逸（默认 false，不开）。
 *  - homeDir 可注入（缺省 os.homedir()），便于单测不触真实家目录。
 *  - 纯函数（除读 os.homedir 默认值）：只读目录值判断，[MUST NOT] 动 fs、[MUST NOT] 改 safeCwd 语义。
 */
import os from "node:os";
import path from "node:path";

/** assertCwdNotSuspiciousRoot 选项。 */
export interface AssertSuspiciousRootOpts {
  /** 显式逃逸：true 时跳过守卫（默认 false，须显式 opt-in） */
  allowDangerous?: boolean;
  /** 注入家目录（缺省 os.homedir()），便于单测 */
  homeDir?: string;
}

/**
 * 校验 dir 非「可疑根」（= 家目录本体 / 文件系统根）；命中 → throw fail-loud。
 * allowDangerous===true 跳过。
 */
export const assertCwdNotSuspiciousRoot = (
  dir: string,
  opts?: AssertSuspiciousRootOpts,
): void => {
  if (opts?.allowDangerous === true) {
    return;
  }
  const abs = path.resolve(dir);
  const home = path.resolve(opts?.homeDir ?? os.homedir());
  const fsRoot = path.parse(abs).root;
  if (abs === home) {
    throw new Error(
      `cwd 为家目录本体（${abs}），该入口涉整目录替换 + 删除，拒绝在此运行；` +
        `请在具体项目目录内运行，如确需请显式 --allow-dangerous`,
    );
  }
  if (abs === fsRoot) {
    throw new Error(
      `cwd 为文件系统根（${abs}），该入口涉整目录替换 + 删除，拒绝在此运行；` +
        `请在具体项目目录内运行，如确需请显式 --allow-dangerous`,
    );
  }
};
