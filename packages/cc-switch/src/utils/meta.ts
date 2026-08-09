import { resolveHandlerContext, xPrompts } from "@done-coding/cli-utils";
import { PROFILE_PATH, PROVIDER_PATH } from "./path";
import type { MetaAction, ProfileConfig, ProviderConfig } from "@/types";

/**
 * meta 自身命令面常量（REQ-1：--meta-* 前缀均属 cc-switch 自身，
 * [MUST NOT] 透传给 claude；未知前缀由 parseArgv fail-fast 拦截）。
 */
export const META_PROFILE_PREFIX = "--meta-profile=";
export const META_PICK = "--meta-pick";
export const META_GENERATE = "--meta-generate";
export const META_APIKEY_PREFIX = "--meta-apiKey=";
export const META_MODELNAME_PREFIX = "--meta-model-name=";
export const META_PROVIDER_PREFIX = "--meta-provider=";
export const META_PROVIDER_LIST = "--meta-provider-list";
export const META_MODEL_LIST = "--meta-model-list";
export const META_HELP = "--meta-help";
export const META_VERSION = "--meta-version";

/** REQ-6 优先级：help > version > generate > modellist > providerlist > addmodel > setkey > pick > profile > run */
export const META_ACTION_PRIORITY: Record<MetaAction, number> = {
  run: 0,
  profile: 1,
  pick: 2,
  setkey: 3,
  addmodel: 4,
  providerlist: 5,
  modellist: 6,
  generate: 7,
  version: 8,
  help: 9,
};

/** 归并动作：取优先级高者 */
export const mergeAction = (
  current: MetaAction,
  next: MetaAction,
): MetaAction =>
  META_ACTION_PRIORITY[next] > META_ACTION_PRIORITY[current] ? next : current;

/** 是否未知 meta 前缀（已知集之外的 --meta-*，REQ-1 fail-fast 用） */
export const isUnknownMetaOption = (arg: string): boolean =>
  arg.startsWith("--meta-") &&
  arg !== META_PICK &&
  arg !== META_GENERATE &&
  arg !== META_HELP &&
  arg !== META_VERSION &&
  arg !== META_PROVIDER_LIST &&
  arg !== META_MODEL_LIST &&
  !arg.startsWith(META_PROFILE_PREFIX) &&
  !arg.startsWith(META_APIKEY_PREFIX) &&
  !arg.startsWith(META_MODELNAME_PREFIX) &&
  !arg.startsWith(META_PROVIDER_PREFIX);

/** REQ-4：自身帮助输出（[MUST NOT] 读配置，纯模板） */
export const printMetaHelp = (): void => {
  process.stdout.write(
    [
      "dc-cc-switch（cc-router）— claude-code 模型路由透传",
      "",
      "用法:",
      "  dc-cc-switch [meta 选项] <claude 参数...>",
      "",
      "meta 选项（cc-switch 自身命令面，不透传给 claude）:",
      `  ${META_PROFILE_PREFIX}<name>  显式指定 profile 启动`,
      `  ${META_PICK}            终端交互选择 profile 启动`,
      `  ${META_GENERATE}        从 provider.json + model.json 重新生成 profile.json`,
      `  ${META_APIKEY_PREFIX}<key>   更新指定提供商 apiKey（自动重建）`,
      `  ${META_MODELNAME_PREFIX}<name> 添加模型（自动重建）`,
      `  ${META_PROVIDER_PREFIX}<id>  显式指定 provider（供 apiKey/model-name 跳过选择）`,
      `  ${META_PROVIDER_LIST}     输出提供商列表（id + name）`,
      `  ${META_MODEL_LIST}        输出模型列表（name + 所属 provider）`,
      `  ${META_HELP}            显示本帮助`,
      `  ${META_VERSION}         显示版本`,
      "",
      "其余所有参数原样透传给 claude。",
      `配置: ${PROFILE_PATH}`,
      "源: provider.json / model.json（--meta-generate 消费）",
      "",
    ].join("\n"),
  );
};

/** REQ-5：自身版本输出（构建注入值，与 package.json 一致） */
export const printMetaVersion = (version: string): void => {
  process.stdout.write(`${version}\n`);
};

/**
 * REQ-3：终端交互选择 profile（prompts select，箭头选择），选中即启动语义。
 * 非 TTY → stderr 提示 + exit(1)（REQ-7，文案含显式指定替代路径）；
 * 交互取消 → xPrompts onCancel 已 process.exit(1)（REQ-3，不写配置不 spawn）。
 * 渲染安全：主命令形态下 stderr 的 punycode DEP0040 警告由 cli 主包入口
 * 抑制（否则警告插入渲染帧导致终端错乱）。
 */
export const pickProfile = async (cfg: ProfileConfig): Promise<string> => {
  const names = Object.keys(cfg.profiles);
  if (names.length === 0) {
    process.stderr.write(
      `配置中没有可用 profile，请先编辑 ${PROFILE_PATH}。\n`,
    );
    process.exit(1);
  }

  if (!resolveHandlerContext().interactive) {
    process.stderr.write(
      `--meta-pick 需要交互式终端，请改用 --meta-profile=<name> 显式指定。\n`,
    );
    process.exit(1);
  }

  const { profile } = await xPrompts({
    type: "select",
    name: "profile",
    message: "选择以哪个配置启动 claude",
    choices: names.map((name) => ({ title: name, value: name })),
  });

  return profile;
};

/**
 * 交互选择提供商（setkey/addmodel 用，prompts select）。
 * 非 TTY → stderr 提示改用 --meta-provider=<id> + exit(1)；
 * provider.json 无提供商 → 提示编辑 + exit(1)。与 pickProfile 行为对齐。
 */
export const selectProvider = async (pc: ProviderConfig): Promise<string> => {
  const ids = Object.keys(pc.providers);
  if (ids.length === 0) {
    process.stderr.write(
      `provider.json 没有可用提供商，请先编辑 ${PROVIDER_PATH}。\n`,
    );
    process.exit(1);
  }

  if (!resolveHandlerContext().interactive) {
    process.stderr.write(
      `需要交互式终端选择提供商，请改用 ${META_PROVIDER_PREFIX}<id> 显式指定。\n`,
    );
    process.exit(1);
  }

  const { provider } = await xPrompts({
    type: "select",
    name: "provider",
    message: "选择提供商",
    choices: ids.map((id) => ({
      title: `${id}（${pc.providers[id].name}）`,
      value: id,
    })),
  });

  return provider;
};
