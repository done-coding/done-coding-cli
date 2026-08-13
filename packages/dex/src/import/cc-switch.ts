import { homedir } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { xPrompts, outputConsole } from "@done-coding/cli-utils";
import { DEX_REAL_DIR } from "@/init/symlink";

/**
 * 从 dc-cc-switch 一次性导入模型配置（用户授权后）。
 *
 * cc-switch 本质是 Claude Code 大脑切换器（provider 端点即 anthropic 兼容），
 * 故导入**只转 anthropic 协议**（models.json `api: "anthropic-messages"`）；
 * openai 协议由用户在 dex 自行配置。
 *
 * 源：~/.done-coding/cc-switch/settings.json（结构化唯一源，含真实 apiKey）
 * 目标（coding-agent 约定，经软链物理落 ~/.done-coding/dex/agent/）：
 *  - models.json：{ providers: { <id>: { baseUrl, api, models } } }
 *  - auth.json：  { <providerId>: { type: "api_key", key } }
 */

/** cc-switch settings.json 结构（dex 侧只读消费，自定契约、低耦合） */
interface CcSwitchSettings {
  providers: Record<
    string,
    {
      name: string;
      url: string;
      apiKey: string;
      models: Array<{
        id: string;
        name: string;
        envExtraParams?: Record<string, string>;
      }>;
    }
  >;
}

const CC_SWITCH_SETTINGS_PATH = path.join(
  homedir(),
  ".done-coding",
  "cc-switch",
  "settings.json",
);

/** coding-agent agentDir（~/.pi/agent，经软链物理落 ~/.done-coding/dex/agent） */
const AGENT_DIR = path.join(homedir(), ".pi", "agent");
const MODELS_PATH = path.join(AGENT_DIR, "models.json");
const AUTH_PATH = path.join(AGENT_DIR, "auth.json");
const SETTINGS_PATH = path.join(AGENT_DIR, "settings.json");

/**
 * 写入/合并 coding-agent settings.json 的默认模型（defaultProvider/defaultModel），
 * 不覆盖已有其它字段（如 theme/lastChangelogVersion）。
 */
const writeDefaultModelSettings = (
  defaultProvider: string | undefined,
  defaultModel: string | undefined,
): void => {
  if (!defaultProvider || !defaultModel) {
    return;
  }
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    // 缺失/非法 → 新建
  }
  settings.defaultProvider = defaultProvider;
  settings.defaultModel = defaultModel;
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
};

/**
 * dex 是否已有模型配置（已配置则跳过导入）。
 * 只看文件存在不够——coding-agent 首次运行会初始化空的 auth.json（`{}`）与
 * 无 models.json，此时视为未配置，仍应触发 cc-switch 导入。
 */
const isDexConfigured = (): boolean => {
  if (existsSync(MODELS_PATH)) {
    try {
      const models = JSON.parse(readFileSync(MODELS_PATH, "utf-8")) as {
        providers?: Record<string, unknown>;
      };
      if (models.providers && Object.keys(models.providers).length > 0) {
        return true;
      }
    } catch {
      // 非法 JSON 视为未配置
    }
  }
  if (existsSync(AUTH_PATH)) {
    try {
      const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as Record<
        string,
        unknown
      >;
      if (Object.keys(auth).length > 0) {
        return true;
      }
    } catch {
      // 非法 JSON 视为未配置
    }
  }
  return false;
};

/** 读取 cc-switch settings.json；缺失/非法返回 null */
const readCcSwitchSettings = (): CcSwitchSettings | null => {
  if (!existsSync(CC_SWITCH_SETTINGS_PATH)) {
    return null;
  }
  try {
    const raw = JSON.parse(
      readFileSync(CC_SWITCH_SETTINGS_PATH, "utf-8"),
    ) as CcSwitchSettings;
    if (
      !raw.providers ||
      typeof raw.providers !== "object" ||
      Object.keys(raw.providers).length === 0
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
};

/**
 * 剥离 Claude Code 的上下文标记 `[1m]`（如 "deepseek-v4-flash[1m]" → "deepseek-v4-flash"）。
 * [1m] 是 CC 的 1M 上下文档位标记，API 层（deepseek/ark）均接受剥离后的真实模型名；
 * coding-agent 不解析 [1m]（会按 128K context 字面处理），剥离后命中内置 1M 档目录。
 */
const stripContextMarker = (name: string): string =>
  name.replace(/\[1m\]$/, "");

/**
 * 翻译：settings.json → models.json / auth.json（只 anthropic 协议）。
 * 同时给出默认 provider/model（第一个有 apiKey 的 provider 的首个模型），
 * 供写入 coding-agent settings.json 的 defaultProvider/defaultModel——
 * 防止默认模型被环境残留的 ANTHROPIC_* 或内置模型目录干扰。
 */
export const translate = (
  settings: CcSwitchSettings,
): {
  models: unknown;
  auth: unknown;
  defaultProvider: string | undefined;
  defaultModel: string | undefined;
} => {
  const providers: Record<string, unknown> = {};
  const auth: Record<string, unknown> = {};
  let defaultProvider: string | undefined;
  let defaultModel: string | undefined;
  for (const [id, provider] of Object.entries(settings.providers)) {
    // 剥离 [1m] + 去重（[1m] 变体与同名模型合并）
    const modelIds = [
      ...new Set(provider.models.map((m) => stripContextMarker(m.name))),
    ];
    providers[id] = {
      baseUrl: provider.url,
      api: "anthropic-messages",
      models: modelIds.map((modelId) => ({ id: modelId })),
    };
    if (provider.apiKey) {
      auth[id] = { type: "api_key", key: provider.apiKey };
      if (!defaultProvider && modelIds.length > 0) {
        defaultProvider = id;
        defaultModel = modelIds[0];
      }
    }
  }
  return { models: { providers }, auth, defaultProvider, defaultModel };
};

/**
 * 首次启动导入：dex 未配置 + 检测到 cc-switch 配置 → 询问授权 → 写入。
 * 返回是否执行了导入（true=已导入 / false=跳过：已配置、无 cc-switch 或用户拒绝）。
 */
export const importFromCcSwitch = async (): Promise<boolean> => {
  if (isDexConfigured()) {
    return false;
  }
  const settings = readCcSwitchSettings();
  if (!settings) {
    return false;
  }

  const providerNames = Object.values(settings.providers)
    .map((p) => p.name)
    .join("、");
  const { confirm } = await xPrompts({
    type: "confirm",
    name: "confirm",
    message: `检测到 cc-switch 配置（${providerNames}），是否导入为 Dex 模型配置？（仅 anthropic 协议）`,
    initial: true,
  });
  if (!confirm) {
    return false;
  }

  const { models, auth, defaultProvider, defaultModel } = translate(settings);
  mkdirSync(AGENT_DIR, { recursive: true });
  writeFileSync(MODELS_PATH, JSON.stringify(models, null, 2), "utf-8");
  writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2), "utf-8");
  writeDefaultModelSettings(defaultProvider, defaultModel);
  outputConsole.info(`已从 cc-switch 导入模型配置 → ${DEX_REAL_DIR}`);
  return true;
};
