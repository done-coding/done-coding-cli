import readline from "node:readline";
import type { Profile } from "@/types";

const SECRET_KEY_RE = /TOKEN|KEY|SECRET/i;

/** 抛出此错误表示用户中断（Ctrl+C / EOF）：调用方据此不回写、非 0 退出。 */
export class PromptAbortError extends Error {
  public constructor() {
    super("用户中断输入");
    this.name = "PromptAbortError";
  }
}

/** 键名是否为敏感（token 类）键（纯函数，可单测）。 */
export const isSecretKey = (key: string): boolean => SECRET_KEY_RE.test(key);

/** 固定遮蔽：不含任何明文片段（纯函数，可单测，REQ-6 报错脱敏用）。 */
export const maskValue = (v: string): string => (v === "" ? "" : "******");

/**
 * 找出值严格等于 `""` 的键（纯函数，可单测）。
 * 仅严格空字符串命中（"REPLACE_ME" 等非空占位不算）；按 Object.keys 插入顺序返回。
 */
export const findEmptyKeys = (env: Record<string, string>): string[] =>
  Object.keys(env).filter((k) => env[k] === "");

/** 当前是否注册过 raw 模式（用于 releaseStdin 决定是否需 setRawMode(false)）。 */
let rawModeEngaged = false;
/** 当前活动的 readline interface（用于 releaseStdin 关闭）。 */
let activeRl: readline.Interface | null = null;

/**
 * 普通回显行输入：提示与回显走 stderr（不污染 claude stdout，呼应 REQ-1 警戒线）。
 */
export const askVisible = (label: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    activeRl = rl;
    rl.on("close", () => {
      if (activeRl === rl) {
        activeRl = null;
      }
    });
    rl.question(label, (answer) => {
      rl.close();
      resolve(answer);
    });
    rl.on("SIGINT", () => {
      rl.close();
      reject(new PromptAbortError());
    });
  });
};

/** ASCII 控制码 */
const CTRL_C = 3;
const CTRL_D = 4;
const BACKSPACE = 127;

/**
 * 无回显行输入（REQ-6 遮蔽）：raw stdin 逐字符读，回车结束，
 * Backspace 处理，Ctrl+C / EOF 抛中断，全程不向终端写明文。
 */
export const readSecret = (label: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    process.stderr.write(label);

    const stdin = process.stdin;
    if (typeof stdin.setRawMode === "function") {
      stdin.setRawMode(true);
      rawModeEngaged = true;
    }
    stdin.resume();
    stdin.setEncoding("utf8");

    let buf = "";

    const cleanup = () => {
      stdin.removeListener("data", onData);
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stderr.write("\n");
          resolve(buf);
          return;
        }
        if (code === CTRL_C || code === CTRL_D) {
          cleanup();
          process.stderr.write("\n");
          reject(new PromptAbortError());
          return;
        }
        if (code === BACKSPACE || ch === "\b") {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };

    stdin.on("data", onData);
  });
};

/**
 * 缺字段补全：对 findEmptyKeys 结果按稳定顺序逐键提示。
 * isSecretKey 为真用 readSecret（无回显）否则 askVisible（回显）；
 * 输入空字符串 → 视为仍空，重新提示同键；
 * 中断（Ctrl+C/EOF）→ throw PromptAbortError（调用方不回写、非 0 退出）。
 * 全部完成后由调用方整体回写。
 */
export const fillEmptyEnv = async (profile: Profile): Promise<void> => {
  const emptyKeys = findEmptyKeys(profile.env);
  for (const key of emptyKeys) {
    const secret = isSecretKey(key);
    let value = "";
    // 空回车视为仍空，重新提示同一键
    while (value === "") {
      const label = `请输入 ${key}: `;
      value = secret ? await readSecret(label) : await askVisible(label);
    }
    profile.env[key] = value;
  }
};

/**
 * 补全结束、spawn 之前 [MUST] 干净释放 stdin，让 claude 继承到干净 TTY。
 * 固定顺序：rl.close() → setRawMode(false)（若曾设）→ 解除监听 → stdin.pause()。
 * 仅在执行过补全（有空值键）时调用；无空值键路径未触碰 stdin，无需调用。
 */
export const releaseStdin = (): void => {
  if (activeRl) {
    activeRl.close();
    activeRl = null;
  }
  const stdin = process.stdin;
  if (rawModeEngaged && typeof stdin.setRawMode === "function") {
    stdin.setRawMode(false);
    rawModeEngaged = false;
  }
  stdin.removeAllListeners("data");
  stdin.removeAllListeners("keypress");
  stdin.removeAllListeners("readable");
  stdin.pause();
};
