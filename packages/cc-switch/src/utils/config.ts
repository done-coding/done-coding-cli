import fs from "node:fs";
import path from "node:path";
import { PROFILE_PATH, SETTINGS_PATH } from "./path";
import type {
  Profile,
  ProfileConfig,
  Settings,
  SettingsModel,
  SettingsProvider,
} from "@/types";

/**
 * 纯新装 starter（settings.json 源形态，键集合与旧 DEEPSEEK_TEMPLATE 语义
 * 对齐；apiKey 恒为空字符串——绝不含真实 token，待用户填入）。
 * profile 名 = `${provider}-${id}`（deepseek-flash / deepseek-pro）。
 */
export const DEEPSEEK_SETTINGS_TEMPLATE: Settings = {
  defaultProfile: "deepseek-pro",
  providers: {
    deepseek: {
      name: "DeepSeek",
      url: "https://api.deepseek.com/anthropic",
      apiKey: "",
      envExtraParams: { CLAUDE_CODE_EFFORT_LEVEL: "max" },
      models: [
        { id: "flash", name: "deepseek-v4-flash[1m]" },
        {
          id: "pro",
          name: "deepseek-v4-pro[1m]",
          envExtraParams: {
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash[1m]",
          },
        },
      ],
    },
  },
};

/**
 * 写入 JSON 配置：固定时序 递归 mkdir → writeFile（明文 JSON）→ chmod 600。
 * [MUST NOT] 放宽权限、[MUST NOT] 写注释/额外字段。
 */
const writeJsonFile = (absPath: string, obj: unknown): void => {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2));
  fs.chmodSync(absPath, 0o600);
};

/** 写 profile 配置（profile.json，编译快照） */
export const writeConfig = (cfg: ProfileConfig): void =>
  writeJsonFile(PROFILE_PATH, cfg);

/** 写 settings 源（settings.json，唯一源） */
export const writeSettings = (settings: Settings): void =>
  writeJsonFile(SETTINGS_PATH, settings);

/**
 * 加载配置（运行时主路径，读编译快照）：
 * profile.json 缺失 → 已有 settings 源则 fail-loud 提示 --meta-generate
 * （启动不自动编译，保速度）；纯新装（两者皆无）才写 starter settings + 编译。
 * 存在 → 读 + JSON.parse + 校验（defaultProfile 可选）。
 * 非法 JSON 或缺字段 → throw 携带绝对路径 + 失败原因，[MUST NOT] 覆盖/自愈用户文件。
 */
export const loadOrInitConfig = (): ProfileConfig => {
  if (!fs.existsSync(PROFILE_PATH)) {
    if (fs.existsSync(SETTINGS_PATH)) {
      throw new Error(
        `${PROFILE_PATH} 不存在，但已检测到 settings.json 源。` +
          `请运行 --meta-generate 生成配置。`,
      );
    }
    writeSettings(DEEPSEEK_SETTINGS_TEMPLATE);
    const cfg = buildProfileConfig(DEEPSEEK_SETTINGS_TEMPLATE);
    writeConfig(cfg);
    return cfg;
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

  validateBehaviorFields(cfg, PROFILE_PATH, "配置文件的");

  if (
    typeof cfg.profiles !== "object" ||
    cfg.profiles === null ||
    Array.isArray(cfg.profiles)
  ) {
    throw new Error(`配置文件缺少对象字段 profiles：${PROFILE_PATH}`);
  }

  return cfg as ProfileConfig;
};

// ───────────────────────── settings 源（--meta-generate 输入） ─────────────────────────

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * 校验行为字段（defaultProfile? / disabledDefault? / output?.profileName?），
 * profile.json 与 settings.json 共用（DRY）。任一非法 → fail-loud。
 */
const validateBehaviorFields = (
  parsed: Record<string, unknown>,
  absPath: string,
  label: string,
): void => {
  if (
    parsed.defaultProfile !== undefined &&
    (typeof parsed.defaultProfile !== "string" ||
      parsed.defaultProfile.length === 0)
  ) {
    throw new Error(
      `${label} defaultProfile [MUST] 为非空字符串（可省略）：${absPath}`,
    );
  }
  if (
    parsed.disabledDefault !== undefined &&
    typeof parsed.disabledDefault !== "boolean"
  ) {
    throw new Error(`${label} disabledDefault [MUST] 为布尔：${absPath}`);
  }
  if (parsed.output !== undefined) {
    if (!isPlainObject(parsed.output)) {
      throw new Error(`${label} output [MUST] 为对象：${absPath}`);
    }
    if (
      parsed.output.profileName !== undefined &&
      typeof parsed.output.profileName !== "boolean"
    ) {
      throw new Error(
        `${label} output.profileName [MUST] 为布尔：${absPath}`,
      );
    }
  }
};

/** 校验 envExtraParams 形态：可选的字符串键值对象（缺省空对象）。 */
const parseEnvExtraParams = (
  v: unknown,
  label: string,
): Record<string, string> => {
  if (v === undefined) return {};
  if (!isPlainObject(v)) {
    throw new Error(`${label} [MUST] 为字符串键值对象`);
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string") {
      throw new Error(`${label}.${k} [MUST] 为字符串`);
    }
    out[k] = val;
  }
  return out;
};

/** 读取 JSON 源文件：缺失 / 非法 JSON / 非对象根 → fail-loud（[MUST NOT] 覆盖/自愈）。 */
const readStrictJson = (
  absPath: string,
  label: string,
): Record<string, unknown> => {
  if (!fs.existsSync(absPath)) {
    throw new Error(`源配置文件不存在：${absPath}（请先创建 ${label}）`);
  }
  const raw = fs.readFileSync(absPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} 非法 JSON：${absPath}（${reason}）`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} 结构非法：${absPath}（应为 JSON 对象）`);
  }
  return parsed;
};

/** 解析 settings 单 provider（含内嵌 models 校验）。 */
const parseSettingsProvider = (
  id: string,
  raw: Record<string, unknown>,
): SettingsProvider => {
  const { name, url, apiKey, models } = raw;
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`provider「${id}」缺字符串字段 name：${SETTINGS_PATH}`);
  }
  if (typeof url !== "string" || url.length === 0) {
    throw new Error(`provider「${id}」缺字符串字段 url：${SETTINGS_PATH}`);
  }
  // apiKey 允许空字符串（starter 模板留空待补，启动时 fillEmptyEnv 交互补全）
  if (typeof apiKey !== "string") {
    throw new Error(`provider「${id}」缺字符串字段 apiKey：${SETTINGS_PATH}`);
  }
  const envExtraParams = parseEnvExtraParams(
    raw.envExtraParams,
    `provider「${id}」envExtraParams`,
  );
  if (!Array.isArray(models)) {
    throw new Error(`provider「${id}」缺少数组字段 models：${SETTINGS_PATH}`);
  }
  if (models.length === 0) {
    throw new Error(`provider「${id}」models 为空：${SETTINGS_PATH}`);
  }
  const parsedModels: SettingsModel[] = [];
  for (const m of models) {
    if (!isPlainObject(m)) {
      throw new Error(`provider「${id}」models 项 [MUST] 为对象：${SETTINGS_PATH}`);
    }
    const { id: mId, name: mName } = m;
    if (typeof mId !== "string" || mId.length === 0) {
      throw new Error(
        `provider「${id}」models 项缺字符串字段 id：${SETTINGS_PATH}`,
      );
    }
    if (typeof mName !== "string" || mName.length === 0) {
      throw new Error(
        `provider「${id}」models 项缺字符串字段 name：${SETTINGS_PATH}`,
      );
    }
    const mExtra = parseEnvExtraParams(
      m.envExtraParams,
      `provider「${id}」models 项 envExtraParams`,
    );
    parsedModels.push({
      id: mId,
      name: mName,
      ...(Object.keys(mExtra).length > 0 ? { envExtraParams: mExtra } : {}),
    });
  }
  return {
    name,
    url,
    apiKey,
    ...(Object.keys(envExtraParams).length > 0 ? { envExtraParams } : {}),
    models: parsedModels,
  };
};

/**
 * 加载 settings 源（settings.json）：结构校验 + fail-loud。
 * 仅 --meta-generate / mutate / list 读源；运行时不读（读 profile.json 编译快照）。
 */
export const loadSettings = (): Settings => {
  const parsed = readStrictJson(SETTINGS_PATH, "settings.json");
  validateBehaviorFields(parsed, SETTINGS_PATH, "settings.json");

  const providersRaw = parsed.providers;
  if (!isPlainObject(providersRaw)) {
    throw new Error(`settings.json 缺少对象字段 providers：${SETTINGS_PATH}`);
  }
  const providers: Record<string, SettingsProvider> = {};
  for (const [id, p] of Object.entries(providersRaw)) {
    if (!isPlainObject(p)) {
      throw new Error(`provider「${id}」[MUST] 为对象：${SETTINGS_PATH}`);
    }
    providers[id] = parseSettingsProvider(id, p);
  }
  return {
    ...(parsed.defaultProfile !== undefined
      ? { defaultProfile: parsed.defaultProfile }
      : {}),
    ...(parsed.disabledDefault !== undefined
      ? { disabledDefault: parsed.disabledDefault }
      : {}),
    ...(parsed.output !== undefined ? { output: parsed.output } : {}),
    providers,
  };
};

/**
 * 组合单 profile env：{...通用, ...providerEnvExtraParams, ...modelEnvExtraParams}。
 * 通用 = provider.url/apiKey + model.name 推导的 BASE_URL/AUTH_TOKEN/MODEL/四档/SUBAGENT。
 */
export const composeEnv = (
  provider: SettingsProvider,
  model: SettingsModel,
): Record<string, string> => ({
  ANTHROPIC_BASE_URL: provider.url,
  ANTHROPIC_AUTH_TOKEN: provider.apiKey,
  ANTHROPIC_MODEL: model.name,
  ANTHROPIC_DEFAULT_OPUS_MODEL: model.name,
  ANTHROPIC_DEFAULT_SONNET_MODEL: model.name,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: model.name,
  CLAUDE_CODE_SUBAGENT_MODEL: model.name,
  ...(provider.envExtraParams ?? {}),
  ...(model.envExtraParams ?? {}),
});

/**
 * 从 settings 源构建 profile 配置（profile 名 = `${providerId}-${model.id}`，
 * 保插入顺序）。校验：models 非空 / (provider,id) 不重复 /
 * defaultProfile（有则）落在生成的 profile 中。任一不满足 → fail-loud。
 */
export const buildProfileConfig = (settings: Settings): ProfileConfig => {
  const profiles: Record<string, Profile> = {};
  const seen = new Set<string>();
  for (const [providerId, provider] of Object.entries(settings.providers)) {
    for (const m of provider.models) {
      const name = `${providerId}-${m.id}`;
      if (seen.has(name)) {
        throw new Error(
          `profile 名重复：${name}（provider+id 组合重复）：${SETTINGS_PATH}`,
        );
      }
      seen.add(name);
      profiles[name] = { env: composeEnv(provider, m) };
    }
  }
  if (Object.keys(profiles).length === 0) {
    throw new Error(`settings.json 无可生成 profile：${SETTINGS_PATH}`);
  }
  if (settings.defaultProfile !== undefined && !profiles[settings.defaultProfile]) {
    const available = Object.keys(profiles).join(", ");
    throw new Error(
      `defaultProfile「${settings.defaultProfile}」不在生成的 profile 中。` +
        `可用：${available}。配置文件：${SETTINGS_PATH}`,
    );
  }
  return {
    ...(settings.defaultProfile !== undefined
      ? { defaultProfile: settings.defaultProfile }
      : {}),
    ...(settings.disabledDefault !== undefined
      ? { disabledDefault: settings.disabledDefault }
      : {}),
    ...(settings.output !== undefined ? { output: settings.output } : {}),
    profiles,
  };
};

/** --meta-generate：读 settings 源 → 构建 → 写 profile.json（600）。 */
export const generateConfig = (): ProfileConfig => {
  const cfg = buildProfileConfig(loadSettings());
  writeConfig(cfg);
  return cfg;
};

// ───────────────────────── setkey / addmodel（源变更 + 自动重编译） ─────────────────────────

/**
 * 归一化模型名（--meta-model-name 输入）：
 * id = 去尾部 [1m] 后原样；name = id + "[1m]"（已带则防双拼）。空名 → fail-loud。
 */
export const normalizeModelName = (
  raw: string,
): { id: string; name: string } => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`模型名为空（--meta-model-name 值不可为空）`);
  }
  const id = trimmed.replace(/\[1m\]$/, "");
  return { id, name: `${id}[1m]` };
};

/**
 * 更新 provider.apiKey → 写 settings.json → 自动重编译 profile.json。
 * provider 不存在 → fail-loud（列可用 id）。
 */
export const setProviderApiKey = (
  providerId: string,
  apiKey: string,
): ProfileConfig => {
  const settings = loadSettings();
  const provider = settings.providers[providerId];
  if (!provider) {
    throw new Error(
      `provider「${providerId}」不存在。可用：${Object.keys(settings.providers).join(", ")}。配置文件：${SETTINGS_PATH}`,
    );
  }
  provider.apiKey = apiKey;
  writeSettings(settings);
  return generateConfig();
};

/**
 * 追加模型 → 写 settings.json → 自动重编译 profile.json。
 * provider 不存在 / (provider,id) 已存在 → fail-loud。
 */
export const addModelEntry = (
  providerId: string,
  modelName: string,
): ProfileConfig => {
  const { id, name } = normalizeModelName(modelName);
  const settings = loadSettings();
  const provider = settings.providers[providerId];
  if (!provider) {
    throw new Error(
      `provider「${providerId}」不存在。可用：${Object.keys(settings.providers).join(", ")}。配置文件：${SETTINGS_PATH}`,
    );
  }
  const dup = provider.models.find((m) => m.id === id);
  if (dup) {
    throw new Error(
      `model「${providerId}/${id}」已存在（name=${dup.name}）：${SETTINGS_PATH}`,
    );
  }
  provider.models.push({ id, name });
  writeSettings(settings);
  return generateConfig();
};

// ───────────────────────── provider-list / model-list（只读输出） ─────────────────────────

/** 提供商列表行：`id（name）`，保 settings.json 插入顺序。绝不含 apiKey。 */
export const providerListLines = (settings: Settings): string[] =>
  Object.entries(settings.providers).map(([id, p]) => `${id}（${p.name}）`);

/** 模型列表行：`name（provider）`，保 provider × 模型插入顺序（同模型多 provider 各占一行）。 */
export const modelListLines = (settings: Settings): string[] =>
  Object.entries(settings.providers).flatMap(([pid, p]) =>
    p.models.map((m) => `${m.name}（${pid}）`),
  );
