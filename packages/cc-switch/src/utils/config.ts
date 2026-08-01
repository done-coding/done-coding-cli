import fs from "node:fs";
import path from "node:path";
import { PROFILE_PATH } from "./path";
import type { ProfileConfig } from "@/types";

/**
 * REQ-3 内置 deepseek 模板。键集合与 requirements REQ-3 表逐键一致；
 * ANTHROPIC_AUTH_TOKEN 恒为空字符串（绝不含真实 token）。
 */
export const DEEPSEEK_TEMPLATE: ProfileConfig = {
  defaultProfile: "deepseek",
  profiles: {
    deepseek: {
      env: {
        ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_MODEL: "deepseek-v4-pro[1m]",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro[1m]",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro[1m]",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
        CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-v4-pro[1m]",
        CLAUDE_CODE_EFFORT_LEVEL: "max",
      },
    },
  },
};

/**
 * 写入配置：固定时序 递归 mkdir → writeFile（明文 JSON）→ chmod 600。
 * [MUST NOT] 放宽权限、[MUST NOT] 写注释/额外字段。
 */
export const writeConfig = (cfg: ProfileConfig): void => {
  fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(cfg, null, 2));
  fs.chmodSync(PROFILE_PATH, 0o600);
};

/**
 * 加载配置：文件不存在 → 写内置模板（600）后返回；
 * 存在 → 读 + JSON.parse + 校验 defaultProfile/profiles 结构。
 * 非法 JSON 或缺字段 → throw 携带绝对路径 + 失败原因，[MUST NOT] 覆盖/自愈用户文件。
 */
export const loadOrInitConfig = (): ProfileConfig => {
  if (!fs.existsSync(PROFILE_PATH)) {
    writeConfig(DEEPSEEK_TEMPLATE);
    return DEEPSEEK_TEMPLATE;
  }

  const raw = fs.readFileSync(PROFILE_PATH, "utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`配置文件非法 JSON：${PROFILE_PATH}（${reason}）`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`配置文件结构非法：${PROFILE_PATH}（应为 JSON 对象）`);
  }

  const cfg = parsed as Partial<ProfileConfig>;

  if (typeof cfg.defaultProfile !== "string") {
    throw new Error(`配置文件缺少字符串字段 defaultProfile：${PROFILE_PATH}`);
  }

  if (
    typeof cfg.profiles !== "object" ||
    cfg.profiles === null ||
    Array.isArray(cfg.profiles)
  ) {
    throw new Error(`配置文件缺少对象字段 profiles：${PROFILE_PATH}`);
  }

  return cfg as ProfileConfig;
};
