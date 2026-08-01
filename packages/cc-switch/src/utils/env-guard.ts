import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 模型路由判定常量（单一来源，REQ-7 层 1 / 层 2 共用）。
 * [MUST NOT] 增减白名单；[MUST NOT] 把 CLAUDE_CODE_ 做成「凡前缀全删」。
 */
export const MODEL_ENV_PREFIX = /^ANTHROPIC_/;
export const MODEL_ENV_WHITELIST = [
  "CLAUDE_CODE_SUBAGENT_MODEL",
  "CLAUDE_CODE_EFFORT_LEVEL",
] as const;

/** ~/.claude/settings.json 绝对路径（层 2 只读检测目标）。 */
export const SETTINGS_PATH = path.join(
  os.homedir(),
  ".claude",
  "settings.json",
);

/**
 * 是否「模型路由类」key：`/^ANTHROPIC_/` 前缀精确匹配
 * 或 `{CLAUDE_CODE_SUBAGENT_MODEL, CLAUDE_CODE_EFFORT_LEVEL}` 白名单精确等值。
 * [MUST NOT] 用模糊子串匹配替代精确判定。
 */
export const isModelEnvKey = (key: string): boolean =>
  MODEL_ENV_PREFIX.test(key) ||
  (MODEL_ENV_WHITELIST as readonly string[]).includes(key);

/**
 * REQ-7 层 1：strip-then-inject（纯函数，可单测）。
 * 复制 processEnv → 删除所有模型路由类 key → 注入 profileEnv（顺序不可反）。
 * 仅作用于返回的子进程 env 对象，[MUST NOT] 修改 cc-router 自身 process.env，
 * [MUST NOT] 读/写任何文件。空 profileEnv `{}` 仍 strip（不回退继承值）。
 * 非模型 CLAUDE_CODE_* / PATH / HOME 等一律不动。
 */
export const buildChildEnv = (
  processEnv: NodeJS.ProcessEnv,
  profileEnv: Record<string, string>,
): Record<string, string> => {
  const result: Record<string, string> = {};

  // 1) 复制继承环境，跳过模型路由类 key（= strip 继承的模型变量）
  for (const [k, v] of Object.entries(processEnv)) {
    if (v === undefined) {
      continue;
    }
    if (isModelEnvKey(k)) {
      continue;
    }
    result[k] = v;
  }

  // 2) 注入选定 profile 的 env（profile 值覆盖；顺序固定在 strip 之后）
  for (const [k, v] of Object.entries(profileEnv)) {
    result[k] = v;
  }

  return result;
};

/**
 * REQ-7 层 2 纯判定（纯函数，可单测）：返回 settings.json env 块中
 * 命中模型路由类判定的 key 列表（判定规则与层 1 完全一致）。
 */
export const hasModelEnvConflict = (
  settingsEnvObj: Record<string, unknown> | null | undefined,
): string[] => {
  if (!settingsEnvObj || typeof settingsEnvObj !== "object") {
    return [];
  }
  return Object.keys(settingsEnvObj).filter((k) => isModelEnvKey(k));
};

/**
 * REQ-7 层 2 IO：只读 ~/.claude/settings.json 的 env 块。
 * 不存在 / 坏 JSON / 无 env / env 非对象 → 返回 null（视为无冲突放行）。
 * [MUST NOT] 修改 / 创建 / 删除 settings.json。
 */
export const readSettingsEnv = (): Record<string, unknown> | null => {
  let parsed: unknown;
  try {
    // 直接读：不存在（ENOENT）与坏 JSON 同样视为无冲突放行，
    // 避免 existsSync→read 的 TOCTOU 双 stat。
    parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const env = (parsed as { env?: unknown }).env;
  if (typeof env !== "object" || env === null || Array.isArray(env)) {
    return null;
  }
  return env as Record<string, unknown>;
};
