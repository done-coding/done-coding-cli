import fs from "node:fs/promises";
import path from "node:path";
import { ConfigUITimeoutError, serveConfigUI } from "@done-coding/config-ui";
import { resolveHandlerContext } from "@done-coding/cli-utils";
import {
  buildProfileConfig,
  parseSettings,
  reportProfileChanges,
} from "./config";
import { assignMissingUuids, isSettingsV2 } from "./settings-v2";
import {
  assertSettingsTargetAsync,
  atomicWriteSettingsAsync,
} from "./settings-file";
import { settingsFormSchema } from "./settings-form";
import { PROFILE_PATH, SETTINGS_PATH } from "./path";
import type { SettingsV2Input, ProfileConfig } from "@/types";

/** 与 generateConfig 共用编译器和改名提示；HTTP 回调的 I/O 保持异步。 */
const rebuildProfiles = async (cfg: ProfileConfig): Promise<void> => {
  let previous: string[] | undefined = [];
  try {
    const old = JSON.parse(await fs.readFile(PROFILE_PATH, "utf8"));
    if (
      !old ||
      typeof old.profiles !== "object" ||
      !old.profiles ||
      Array.isArray(old.profiles)
    )
      throw new Error("profiles 非对象");
    previous = Object.keys(old.profiles);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      previous = undefined;
      process.stderr.write(
        "旧 profile.json 无法比较名称，将按 settings 重建。\n",
      );
    }
  }
  await atomicWriteSettingsAsync(PROFILE_PATH, cfg);
  if (previous) reportProfileChanges(previous, Object.keys(cfg.profiles));
};

const saveSubmission = async (
  value: Record<string, unknown>,
): Promise<void> => {
  let settings;
  let cfg: ProfileConfig;
  try {
    const input = value as unknown as SettingsV2Input;
    // config-ui 把缺省对象数组初始化为 []；输入框清空为 ""。
    // 只转换这两种表单空值，不放宽持久化 v2 的凭据二选一约束。
    const providers = input.providers.map((provider) => {
      const p = { ...provider };
      if (p.accounts?.length === 0 && p.apiKey !== undefined) delete p.accounts;
      else if (p.accounts?.length && p.apiKey === "") delete p.apiKey;
      return p;
    });
    settings = assignMissingUuids({ ...input, providers });
    cfg = buildProfileConfig(parseSettings(settings));
  } catch (error) {
    throw new Error(`--meta-ui 校验失败，未写入：${(error as Error).message}`);
  }
  const root = path.dirname(SETTINGS_PATH);
  // 先检查两个目标，避免已知 profile 软链错误发生在源写入之后。
  await assertSettingsTargetAsync(root, SETTINGS_PATH);
  await assertSettingsTargetAsync(root, PROFILE_PATH);
  try {
    await atomicWriteSettingsAsync(SETTINGS_PATH, settings);
  } catch {
    throw new Error(
      "--meta-ui 保存失败，settings 未替换，请检查目录权限后重试。",
    );
  }
  try {
    await rebuildProfiles(cfg);
  } catch {
    throw new Error(
      "--meta-ui settings 已保存，但 profile 重建失败；请检查目标路径和权限后运行 --meta-generate。",
    );
  }
  process.stdout.write(
    `已保存 settings，重建 ${Object.keys(cfg.profiles).length} 个 profile → ${PROFILE_PATH}\n`,
  );
};

export interface MetaUIOptions {
  openBrowser?: boolean;
  timeoutMs?: number;
}

/** 入口等待会话结果；调用方将 reject 映射为非零退出码。 */
export const runMetaUI = async (options: MetaUIOptions = {}): Promise<void> => {
  await assertSettingsTargetAsync(path.dirname(SETTINGS_PATH), SETTINGS_PATH);
  const raw = await fs.readFile(SETTINGS_PATH, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("settings.json 非法 JSON，请修正后重试 --meta-ui。");
  }
  const settings = parseSettings(value);
  if (!isSettingsV2(settings))
    throw new Error(
      "--meta-ui 需要 settings v2，请先运行 --meta-migrate 显式迁移。",
    );
  try {
    const { url, done } = await serveConfigUI({
      schema: settingsFormSchema,
      value: settings as unknown as Record<string, unknown>,
      onSubmit: saveSubmission,
      openBrowser: options.openBrowser ?? resolveHandlerContext().interactive,
      timeoutMs: options.timeoutMs,
    });
    process.stdout.write(
      `配置界面已启动；如未自动打开浏览器，请打开：\n${url}\n`,
    );
    await done;
  } catch (error) {
    if (error instanceof ConfigUITimeoutError)
      throw new Error("--meta-ui 会话超时，未完成保存；请重新运行 --meta-ui。");
    throw error;
  }
};
