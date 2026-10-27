import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pkg from "../../package.json";
import { SETTINGS_PATH } from "./path";
import { parseSettings, buildProfileConfig, writeSettings } from "./config";
import { assignMissingUuids, isSettingsV2 } from "./settings-v2";
import { assertSettingsTarget } from "./settings-file";
import type { Settings, SettingsV2 } from "@/types";

export const SETTINGS_SCHEMA_URL = `https://cdn.jsdelivr.net/npm/@done-coding/cli-cc-switch@${pkg.version}/settings.schema.json`;

/** 不自动合并 provider；默认完整名通过枚举匹配，不拆含连字符的 alias。 */
export const migrateSettings = (
  settings: Settings,
): { settings: SettingsV2; warnings: string[] } => {
  const { defaultProfile, providers, ...behavior } = settings;
  const next = assignMissingUuids({
    $schema: SETTINGS_SCHEMA_URL,
    version: 2,
    ...behavior,
    providers: Object.entries(providers).map(([alias, p]) => ({
      ...p,
      alias,
      models: p.models.map(({ id, ...m }) => ({ ...m, alias: id })),
    })),
  });
  const warnings: string[] = [];
  if (defaultProfile !== undefined) {
    for (const p of next.providers)
      for (const m of p.models) {
        if (`${p.alias}-${m.alias}` === defaultProfile)
          next.defaultProfile = { provider: p.uuid, model: m.uuid };
      }
    if (!next.defaultProfile)
      warnings.push(
        "默认 profile 悬空，迁移已省略 defaultProfile；请重新选择默认项。",
      );
  }
  buildProfileConfig(next);
  return { settings: next, warnings };
};

/** 显式 v1 → v2；先验证，再保留原字节备份，最后原子替换源。 */
export const migrateSettingsFile = (): { backupPath?: string } => {
  const original = fs.readFileSync(SETTINGS_PATH);
  const current = parseSettings(JSON.parse(original.toString("utf8")));
  if (isSettingsV2(current)) {
    process.stdout.write("settings 已是 v2，无需迁移。\n");
    return {};
  }
  const next = migrateSettings(current);
  const root = path.dirname(SETTINGS_PATH);
  assertSettingsTarget(root, SETTINGS_PATH);
  const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  const backupPath = `${SETTINGS_PATH}.v1-${stamp}.bak`;
  assertSettingsTarget(root, backupPath);
  fs.writeFileSync(backupPath, original, { flag: "wx", mode: 0o600 });
  fs.chmodSync(backupPath, 0o600);
  writeSettings(next.settings);
  for (const warning of next.warnings) process.stderr.write(`${warning}\n`);
  process.stdout.write(
    `已迁移 settings v2，备份：${backupPath}。请运行 --meta-generate 重建 profile。\n`,
  );
  return { backupPath };
};
