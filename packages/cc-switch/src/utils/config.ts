import fs from "node:fs";
import path from "node:path";
import { MODEL_PATH, PROFILE_PATH, PROVIDER_PATH } from "./path";
import type {
  Model,
  ModelConfig,
  Profile,
  ProfileConfig,
  Provider,
  ProviderConfig,
} from "@/types";

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
 * 写入 JSON 配置：固定时序 递归 mkdir → writeFile（明文 JSON）→ chmod 600。
 * [MUST NOT] 放宽权限、[MUST NOT] 写注释/额外字段。
 */
const writeJsonFile = (absPath: string, obj: unknown): void => {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2));
  fs.chmodSync(absPath, 0o600);
};

/** 写 profile 配置（profile.json） */
export const writeConfig = (cfg: ProfileConfig): void =>
  writeJsonFile(PROFILE_PATH, cfg);

/** 写 provider 源（provider.json） */
export const writeProviderConfig = (cfg: ProviderConfig): void =>
  writeJsonFile(PROVIDER_PATH, cfg);

/** 写 model 源（model.json） */
export const writeModelConfig = (cfg: ModelConfig): void =>
  writeJsonFile(MODEL_PATH, cfg);

/**
 * 加载配置：文件不存在 → 若已有 provider/model 源则 fail-loud 提示 --meta-generate
 * （启动不自动生成，保速度）；纯新装（无任何源）才写内置模板（600）兜底。
 * 存在 → 读 + JSON.parse + 校验 defaultProfile/profiles 结构。
 * 非法 JSON 或缺字段 → throw 携带绝对路径 + 失败原因，[MUST NOT] 覆盖/自愈用户文件。
 */
export const loadOrInitConfig = (): ProfileConfig => {
  if (!fs.existsSync(PROFILE_PATH)) {
    if (fs.existsSync(PROVIDER_PATH) || fs.existsSync(MODEL_PATH)) {
      throw new Error(
        `${PROFILE_PATH} 不存在，但已检测到 provider/model 源。` +
          `请运行 --meta-generate 生成配置。`,
      );
    }
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

// ───────────────────────── provider/model 源（--meta-generate 输入） ─────────────────────────

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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

/** 加载 provider 源（provider.json）：结构校验 + fail-loud。 */
export const loadProviderConfig = (): ProviderConfig => {
  const parsed = readStrictJson(PROVIDER_PATH, "provider.json");
  const providersRaw = parsed.providers;
  if (!isPlainObject(providersRaw)) {
    throw new Error(`provider.json 缺少对象字段 providers：${PROVIDER_PATH}`);
  }
  const providers: Record<string, Provider> = {};
  for (const [id, p] of Object.entries(providersRaw)) {
    if (!isPlainObject(p)) {
      throw new Error(`provider「${id}」[MUST] 为对象：${PROVIDER_PATH}`);
    }
    const { name, url, apiKey } = p;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(`provider「${id}」缺字符串字段 name：${PROVIDER_PATH}`);
    }
    if (typeof url !== "string" || url.length === 0) {
      throw new Error(`provider「${id}」缺字符串字段 url：${PROVIDER_PATH}`);
    }
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      throw new Error(`provider「${id}」缺字符串字段 apiKey：${PROVIDER_PATH}`);
    }
    const envExtraParams = parseEnvExtraParams(
      p.envExtraParams,
      `provider「${id}」envExtraParams`,
    );
    providers[id] = {
      name,
      url,
      apiKey,
      ...(Object.keys(envExtraParams).length > 0 ? { envExtraParams } : {}),
    };
  }
  return { providers };
};

/** 加载 model 源（model.json）：结构校验 + fail-loud。 */
export const loadModelConfig = (): ModelConfig => {
  const parsed = readStrictJson(MODEL_PATH, "model.json");
  const defaultProfile = parsed.defaultProfile;
  if (typeof defaultProfile !== "string" || defaultProfile.length === 0) {
    throw new Error(`model.json 缺少字符串字段 defaultProfile：${MODEL_PATH}`);
  }
  const modelsRaw = parsed.models;
  if (!Array.isArray(modelsRaw)) {
    throw new Error(`model.json 缺少数组字段 models：${MODEL_PATH}`);
  }
  const models: Model[] = [];
  for (const [idx, m] of modelsRaw.entries()) {
    if (!isPlainObject(m)) {
      throw new Error(`model.json models[${idx}] [MUST] 为对象：${MODEL_PATH}`);
    }
    const { provider, id, name } = m;
    if (typeof provider !== "string" || provider.length === 0) {
      throw new Error(
        `model.json models[${idx}] 缺字符串字段 provider：${MODEL_PATH}`,
      );
    }
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(
        `model.json models[${idx}] 缺字符串字段 id：${MODEL_PATH}`,
      );
    }
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(
        `model.json models[${idx}] 缺字符串字段 name：${MODEL_PATH}`,
      );
    }
    const envExtraParams = parseEnvExtraParams(
      m.envExtraParams,
      `model.json models[${idx}] envExtraParams`,
    );
    models.push({
      provider,
      id,
      name,
      ...(Object.keys(envExtraParams).length > 0 ? { envExtraParams } : {}),
    });
  }
  return { defaultProfile, models };
};

/**
 * 组合单 profile env：{...通用, ...providerEnvExtraParams, ...modelEnvExtraParams}。
 * 通用 = provider.url/apiKey + model.name 推导的 BASE_URL/AUTH_TOKEN/MODEL/四档/SUBAGENT。
 */
export const composeEnv = (
  provider: Provider,
  model: Model,
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
 * 从 provider/model 源构建 profile 配置（profile 名 = `${provider}-${id}`，
 * 保插入顺序）。校验：provider 引用存在 / (provider,id) 不重复 / models 非空 /
 * defaultProfile 落在生成的 profile 中。任一不满足 → fail-loud。
 */
export const buildProfileConfig = (
  pc: ProviderConfig,
  mc: ModelConfig,
): ProfileConfig => {
  const profiles: Record<string, Profile> = {};
  const seen = new Set<string>();
  for (const m of mc.models) {
    const provider = pc.providers[m.provider];
    if (!provider) {
      throw new Error(
        `model「${m.id}」引用了不存在的 provider「${m.provider}」：${MODEL_PATH}`,
      );
    }
    const name = `${m.provider}-${m.id}`;
    if (seen.has(name)) {
      throw new Error(
        `profile 名重复：${name}（provider+id 组合重复）：${MODEL_PATH}`,
      );
    }
    seen.add(name);
    profiles[name] = { env: composeEnv(provider, m) };
  }
  if (Object.keys(profiles).length === 0) {
    throw new Error(
      `model.json 的 models 为空，无可生成 profile：${MODEL_PATH}`,
    );
  }
  if (!profiles[mc.defaultProfile]) {
    const available = Object.keys(profiles).join(", ");
    throw new Error(
      `defaultProfile「${mc.defaultProfile}」不在生成的 profile 中。` +
        `可用：${available}。配置文件：${MODEL_PATH}`,
    );
  }
  return { defaultProfile: mc.defaultProfile, profiles };
};

/** --meta-generate：读 provider/model 源 → 构建 → 写 profile.json（600）。 */
export const generateConfig = (): ProfileConfig => {
  const cfg = buildProfileConfig(loadProviderConfig(), loadModelConfig());
  writeConfig(cfg);
  return cfg;
};

// ───────────────────────── setkey / addmodel（源变更 + 自动重建） ─────────────────────────

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
 * 更新 provider.apiKey → 写 provider.json → 自动重建 profile.json。
 * provider 不存在 → fail-loud（列可用 id）。
 */
export const setProviderApiKey = (
  providerId: string,
  apiKey: string,
): ProfileConfig => {
  const pc = loadProviderConfig();
  const provider = pc.providers[providerId];
  if (!provider) {
    throw new Error(
      `provider「${providerId}」不存在。可用：${Object.keys(pc.providers).join(", ")}。配置文件：${PROVIDER_PATH}`,
    );
  }
  provider.apiKey = apiKey;
  writeProviderConfig(pc);
  return generateConfig();
};

/**
 * 追加模型 → 写 model.json → 自动重建 profile.json。
 * provider 不存在 / (provider,id) 已存在 → fail-loud。
 */
export const addModelEntry = (
  providerId: string,
  modelName: string,
): ProfileConfig => {
  const { id, name } = normalizeModelName(modelName);
  const pc = loadProviderConfig();
  if (!pc.providers[providerId]) {
    throw new Error(
      `provider「${providerId}」不存在。可用：${Object.keys(pc.providers).join(", ")}。配置文件：${PROVIDER_PATH}`,
    );
  }
  const mc = loadModelConfig();
  const dup = mc.models.find((m) => m.provider === providerId && m.id === id);
  if (dup) {
    throw new Error(
      `model「${providerId}/${id}」已存在（name=${dup.name}）：${MODEL_PATH}`,
    );
  }
  mc.models.push({ provider: providerId, id, name });
  writeModelConfig(mc);
  return generateConfig();
};

// ───────────────────────── provider-list / model-list（只读输出） ─────────────────────────

/** 提供商列表行：`id（name）`，保 provider.json 插入顺序。绝不含 apiKey。 */
export const providerListLines = (pc: ProviderConfig): string[] =>
  Object.entries(pc.providers).map(([id, p]) => `${id}（${p.name}）`);

/** 模型列表行：`name（provider）`，保 model.json 数组顺序（同模型多 provider 各占一行）。 */
export const modelListLines = (mc: ModelConfig): string[] =>
  mc.models.map((m) => `${m.name}（${m.provider}）`);
