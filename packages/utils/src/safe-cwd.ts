import { homedir } from "node:os";
import { existsSync } from "node:fs";

/**
 * 安全获取当前工作目录。
 * ---
 * `process.cwd()` 在当前工作目录被删除 / 不可访问时会抛 `uv_cwd`(EPERM)，
 * 直接崩掉整个 CLI——连 `-v` / `-h` 这类本不需要 cwd 的快路径也会受牵连
 * （典型触发：`pnpm dlx` 临时目录生命周期、目录瞬时不可访问、同步盘）。
 * 此处兜底回落顺序：`process.cwd()` → `process.env.PWD`(存在才用) → `homedir()`。
 */
export const safeCwd = (): string => {
  try {
    return process.cwd();
  } catch {
    const pwd = process.env.PWD;
    if (pwd && existsSync(pwd)) {
      return pwd;
    }
    return homedir();
  }
};
