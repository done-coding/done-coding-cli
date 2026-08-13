import { homedir } from "node:os";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";

/** dex 配置真实目录（生态统一入口） */
export const DEX_REAL_DIR = path.join(homedir(), ".done-coding", "dex");
/** coding-agent 的配置目录（configDir 固定 ".pi"，经软链落真实目录） */
export const PI_SYMLINK_PATH = path.join(homedir(), ".pi");

/**
 * 确保 `~/.pi → ~/.done-coding/dex` 软链（幂等）。
 *
 * - 真实目录在 ~/.done-coding/dex（done-coding 生态统一配置入口）；
 * - ~/.pi 是 coding-agent 的 configDir 约定，软链适配后其 agentDir（~/.pi/agent）
 *   物理落 ~/.done-coding/dex/agent；
 * - 若 ~/.pi 已存在且是软链：指向正确则跳过，否则重建；
 * - 若 ~/.pi 是真实目录/文件（非软链）：不动（保守，不破坏既有占用）。
 */
export const initSymlink = (): void => {
  mkdirSync(DEX_REAL_DIR, { recursive: true });

  if (!existsSync(PI_SYMLINK_PATH)) {
    symlinkSync(DEX_REAL_DIR, PI_SYMLINK_PATH);
    return;
  }

  try {
    const stat = lstatSync(PI_SYMLINK_PATH);
    if (!stat.isSymbolicLink()) {
      // 真实目录占用 ~/.pi：不破坏，coding-agent 直接用真实目录
      return;
    }
    const target = path.resolve(readlinkSync(PI_SYMLINK_PATH));
    if (target === DEX_REAL_DIR) {
      return;
    }
    // 指向别处：重建（先删软链本身，目标无损）
    rmSync(PI_SYMLINK_PATH, { force: true });
    symlinkSync(DEX_REAL_DIR, PI_SYMLINK_PATH);
  } catch {
    // 竞态/权限异常：跳过，coding-agent 回落真实 ~/.pi
  }
};
