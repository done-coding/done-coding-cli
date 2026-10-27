import { randomUUID } from "node:crypto";
import type { AnySettings, SettingsV2, SettingsV2Input } from "@/types";

export const isSettingsV2 = (settings: AnySettings): settings is SettingsV2 =>
  "version" in settings && settings.version === 2;

export const ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (label: string): never => {
  throw new Error(`settings v2 ${label}`);
};
const string = (v: unknown, label: string, empty = false): void => {
  if (typeof v !== "string" || (!empty && !v.length))
    fail(`${label} 必须为${empty ? "" : "非空"}字符串`);
};
const env = (v: unknown, label: string): void => {
  if (
    v !== undefined &&
    (!object(v) || Object.values(v).some((x) => typeof x !== "string"))
  )
    fail(`${label} 必须为字符串键值对象`);
};
const entities = (v: unknown, label: string): Record<string, unknown>[] => {
  if (!Array.isArray(v) || !v.length) fail(`${label} 必须为非空数组`);
  const uuids = new Set<string>();
  const aliases = new Set<string>();
  return (v as unknown[]).map((e, i) => {
    if (!object(e)) return fail(`${label}[${i}] 必须为对象`);
    if (typeof e.uuid !== "string" || !UUID_PATTERN.test(e.uuid))
      fail(`${label}[${i}].uuid 缺失或非法`);
    if (typeof e.alias !== "string" || !ALIAS_PATTERN.test(e.alias))
      fail(`${label}[${i}].alias 非法`);
    if (uuids.has(e.uuid as string)) fail(`${label} uuid 重复`);
    if (aliases.has(e.alias as string)) fail(`${label} alias 重复：${e.alias}`);
    uuids.add(e.uuid as string);
    aliases.add(e.alias as string);
    return e;
  });
};

/** 不改输入或持久化状态；随机值只用于缺失的身份字段。 */
export const assignMissingUuids = (settings: SettingsV2Input): SettingsV2 =>
  ({
    ...settings,
    providers: settings.providers.map((p) => ({
      ...p,
      uuid: p.uuid === undefined ? randomUUID() : p.uuid,
      ...(p.accounts
        ? {
            accounts: p.accounts.map((a) => ({
              ...a,
              uuid: a.uuid === undefined ? randomUUID() : a.uuid,
            })),
          }
        : {}),
      models: p.models.map((m) => ({
        ...m,
        uuid: m.uuid === undefined ? randomUUID() : m.uuid,
      })),
    })),
  }) as SettingsV2;

export interface ProfileIdentity {
  name: string;
  source: string;
  provider: string;
  account?: string;
  model: string;
}
const identityParts = (
  parts: Array<string | undefined>,
  separator: string,
): string => parts.filter((x) => x !== undefined).join(separator);

export const profileIdentities = (settings: SettingsV2): ProfileIdentity[] =>
  settings.providers.flatMap((p) =>
    (p.accounts ?? [undefined]).flatMap((a) =>
      p.models.map((m) => ({
        name: identityParts([p.alias, a?.alias, m.alias], "-"),
        source: identityParts([p.alias, a?.alias, m.alias], "/"),
        provider: p.uuid,
        ...(a ? { account: a.uuid } : {}),
        model: m.uuid,
      })),
    ),
  );

export const resolveDefaultProfile = (
  settings: SettingsV2,
  ids = profileIdentities(settings),
): string | undefined => {
  const ref = settings.defaultProfile;
  if (ref === undefined) return undefined;
  const found = ids.find(
    (p) =>
      p.provider === ref.provider &&
      p.account === ref.account &&
      p.model === ref.model,
  );
  if (!found)
    fail(
      `默认 profile 悬空。可用：${ids.map((p) => p.name).join(", ")}。请检查 settings.json 后运行 --meta-generate`,
    );
  return found!.name;
};

/** 结构 + 唯一性 + 引用校验；读取不生成任何 UUID。 */
export const parseSettingsV2 = (raw: Record<string, unknown>): SettingsV2 => {
  validateV2Behavior(raw);
  for (const p of entities(raw.providers, "providers")) {
    const label = `provider「${p.alias}」`;
    string(p.name, `${label}.name`);
    string(p.url, `${label}.url`);
    env(p.envExtraParams, `${label}.envExtraParams`);
    if (
      Object.prototype.hasOwnProperty.call(p, "apiKey") ===
      Object.prototype.hasOwnProperty.call(p, "accounts")
    )
      fail(`${label} apiKey / accounts 必须二选一`);
    if (Object.prototype.hasOwnProperty.call(p, "apiKey"))
      string(p.apiKey, `${label}.apiKey`, true);
    else
      for (const a of entities(p.accounts, `${label}.accounts`))
        string(a.apiKey, `${label} account「${a.alias}」.apiKey`, true);
    for (const m of entities(p.models, `${label}.models`)) {
      string(m.name, `${label} model「${m.alias}」.name`);
      env(m.envExtraParams, `${label} model「${m.alias}」.envExtraParams`);
    }
  }
  if (raw.defaultProfile !== undefined) {
    const ref = raw.defaultProfile;
    if (
      !object(ref) ||
      typeof ref.provider !== "string" ||
      typeof ref.model !== "string" ||
      (ref.account !== undefined && typeof ref.account !== "string")
    )
      fail("默认 profile 悬空：defaultProfile 必须是 UUID 引用对象");
  }
  const settings = raw as unknown as SettingsV2;
  const ids = profileIdentities(settings);
  const seen = new Map<string, string>();
  for (const p of ids) {
    if (seen.has(p.name))
      fail(`profile 名冲突：${p.name}（${seen.get(p.name)} 与 ${p.source}）`);
    seen.set(p.name, p.source);
  }
  resolveDefaultProfile(settings, ids);
  return settings;
};

const validateV2Behavior = (raw: Record<string, unknown>): void => {
  if (raw.$schema !== undefined) string(raw.$schema, "$schema");
  if (
    raw.disabledDefault !== undefined &&
    typeof raw.disabledDefault !== "boolean"
  )
    fail("disabledDefault 必须为布尔");
  if (
    raw.output !== undefined &&
    (!object(raw.output) ||
      (raw.output.profileName !== undefined &&
        typeof raw.output.profileName !== "boolean"))
  )
    fail("output.profileName 必须为布尔");
};
