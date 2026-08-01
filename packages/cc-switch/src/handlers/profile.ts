import { PROFILE_PATH } from "@/utils/path";
import {
  META_HELP,
  META_PICK,
  META_PROFILE_PREFIX,
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
  let action: MetaAction = "run";
  const passthrough: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith(META_PROFILE_PREFIX)) {
      // 多个 --meta-profile= 取最后一个生效；被消费项不透传
      profileName = arg.slice(META_PROFILE_PREFIX.length);
      action = mergeAction(action, "profile");
      continue;
    }
    if (arg === META_PICK) {
      action = mergeAction(action, "pick");
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
        `未知 meta 选项：${arg}。可用选项：${META_PROFILE_PREFIX}<name>、${META_PICK}、${META_HELP}、${META_VERSION}`,
      );
    }
    passthrough.push(arg);
  }

  return { action, profileName, passthrough };
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
      `profile "${name}" 不存在。可用 profile：${available}。配置文件：${PROFILE_PATH}`,
    );
  }

  return { name, profile };
};
