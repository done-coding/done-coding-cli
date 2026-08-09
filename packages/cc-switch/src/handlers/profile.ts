import { PROFILE_PATH } from "@/utils/path";
import {
  META_APIKEY_PREFIX,
  META_GENERATE,
  META_HELP,
  META_MODELNAME_PREFIX,
  META_MODEL_LIST,
  META_PICK,
  META_PROFILE_PREFIX,
  META_PROVIDER_PREFIX,
  META_PROVIDER_LIST,
  META_VERSION,
  isUnknownMetaOption,
  mergeAction,
} from "@/utils/meta";
import type { MetaAction, ParsedArgv, Profile, ProfileConfig } from "@/types";

/**
 * 解析 argv（纯函数，可单测）。
 * meta 自身命令面（REQ-1）：--meta-profile=<name>（多个取最后一个生效）、
 * --meta-pick / --meta-help / --meta-version，按 REQ-6 优先级归并 action，
 * 被消费项均不入 passthrough；未知 --meta-* 前缀 fail-fast throw；
 * 其余所有参数按原始顺序原样收集，[MUST NOT] trim/去引号/合并/重排/校验。
 */
export const parseArgv = (argv: string[]): ParsedArgv => {
  let profileName: string | undefined;
  let apiKey: string | undefined;
  let modelName: string | undefined;
  let providerId: string | undefined;
  let action: MetaAction = "run";
  const passthrough: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith(META_PROFILE_PREFIX)) {
      // 多个 --meta-profile= 取最后一个生效；被消费项不透传
      profileName = arg.slice(META_PROFILE_PREFIX.length);
      action = mergeAction(action, "profile");
      continue;
    }
    if (arg.startsWith(META_APIKEY_PREFIX)) {
      apiKey = arg.slice(META_APIKEY_PREFIX.length);
      if (!apiKey) {
        throw new Error(`${META_APIKEY_PREFIX} 需提供 apiKey 值`);
      }
      action = mergeAction(action, "setkey");
      continue;
    }
    if (arg.startsWith(META_MODELNAME_PREFIX)) {
      modelName = arg.slice(META_MODELNAME_PREFIX.length);
      if (!modelName) {
        throw new Error(`${META_MODELNAME_PREFIX} 需提供模型名`);
      }
      action = mergeAction(action, "addmodel");
      continue;
    }
    if (arg.startsWith(META_PROVIDER_PREFIX)) {
      providerId = arg.slice(META_PROVIDER_PREFIX.length);
      if (!providerId) {
        throw new Error(`${META_PROVIDER_PREFIX} 需提供 provider id`);
      }
      // 选择器，不设 action（仅 setkey/addmodel 消费）
      continue;
    }
    if (arg === META_PICK) {
      action = mergeAction(action, "pick");
      continue;
    }
    if (arg === META_GENERATE) {
      action = mergeAction(action, "generate");
      continue;
    }
    if (arg === META_PROVIDER_LIST) {
      action = mergeAction(action, "providerlist");
      continue;
    }
    if (arg === META_MODEL_LIST) {
      action = mergeAction(action, "modellist");
      continue;
    }
    if (arg === META_HELP) {
      action = mergeAction(action, "help");
      continue;
    }
    if (arg === META_VERSION) {
      action = mergeAction(action, "version");
      continue;
    }
    if (isUnknownMetaOption(arg)) {
      // REQ-1：命名空间归属声明——未知 meta 前缀 [MUST NOT] 透传 / 静默忽略
      throw new Error(
        `未知 meta 选项：${arg}。可用选项：${META_PROFILE_PREFIX}<name>、${META_PICK}、${META_GENERATE}、${META_APIKEY_PREFIX}<key>、${META_MODELNAME_PREFIX}<name>、${META_PROVIDER_PREFIX}<id>、${META_PROVIDER_LIST}、${META_MODEL_LIST}、${META_HELP}、${META_VERSION}`,
      );
    }
    passthrough.push(arg);
  }

  validateParsedArgv({ action, apiKey, modelName, providerId });

  return { action, profileName, apiKey, modelName, providerId, passthrough };
};

/**
 * 互斥校验（fail-fast）：两个源变更互斥、源变更与 --meta-generate 互斥、
 * --meta-provider 仅适用 setkey/addmodel（help/version 豁免）。
 */
const validateParsedArgv = (parsed: {
  action: MetaAction;
  apiKey?: string;
  modelName?: string;
  providerId?: string;
}): void => {
  const { action, apiKey, modelName, providerId } = parsed;
  const mutations = [apiKey, modelName].filter((v) => v !== undefined).length;
  if (mutations > 1) {
    throw new Error(
      `不能同时指定 ${META_APIKEY_PREFIX} 与 ${META_MODELNAME_PREFIX}`,
    );
  }
  if (action === "generate" && mutations > 0) {
    throw new Error(
      `${META_GENERATE} 不能与 ${META_APIKEY_PREFIX} / ${META_MODELNAME_PREFIX} 同时使用`,
    );
  }
  if (
    providerId !== undefined &&
    action !== "setkey" &&
    action !== "addmodel" &&
    action !== "help" &&
    action !== "version"
  ) {
    throw new Error(
      `${META_PROVIDER_PREFIX} 仅用于 ${META_APIKEY_PREFIX} / ${META_MODELNAME_PREFIX}`,
    );
  }
};

/**
 * 选择 profile（纯函数，可单测）。
 * 有 profileName 用之，否则用 cfg.defaultProfile。
 * 目标不存在 / defaultProfile 悬空 → throw（列可用名 + 配置路径），
 * [MUST NOT] 猜最近名 / 回退 default。profile.env 为空 `{}` 合法。
 */
export const selectProfile = (
  cfg: ProfileConfig,
  profileName?: string,
): { name: string; profile: Profile } => {
  const name = profileName ?? cfg.defaultProfile;
  const profile = cfg.profiles[name];

  if (!profile) {
    const available = Object.keys(cfg.profiles).join(", ") || "(无)";
    throw new Error(
      `profile "${name}" 不存在。可用 profile：${available}。配置文件：${PROFILE_PATH}` +
        `。若需从 provider.json + model.json 重建，请运行 --meta-generate`,
    );
  }

  return { name, profile };
};
