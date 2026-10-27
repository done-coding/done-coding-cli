import { resolveHandlerContext, xPrompts } from "@done-coding/cli-utils";
import { PROFILE_PATH, SETTINGS_PATH } from "./path";
import { isSettingsV2 } from "./settings-v2";
import { providerListLines } from "./config";
import type {
  MetaAction,
  ProfileConfig,
  AnySettings,
  SettingsProviderV2,
} from "@/types";

/**
 * meta 自身命令面常量（REQ-1：--meta-* 前缀均属 cc-switch 自身，
 * [MUST NOT] 透传给 claude；未知前缀由 parseArgv fail-fast 拦截）。
 */
export const META_PROFILE_PREFIX = "--meta-profile=";
export const META_PICK = "--meta-pick";
export const META_SILENT = "--meta-silent";
export const META_MIGRATE = "--meta-migrate";
export const META_UI = "--meta-ui";
export const META_ACCOUNT_PREFIX = "--meta-account=";
export const META_GENERATE = "--meta-generate";
export const META_APIKEY_PREFIX = "--meta-apiKey=";
export const META_MODELNAME_PREFIX = "--meta-model-name=";
export const META_PROVIDER_PREFIX = "--meta-provider=";
export const META_PROVIDER_LIST = "--meta-provider-list";
export const META_MODEL_LIST = "--meta-model-list";
export const META_HELP = "--meta-help";
export const META_VERSION = "--meta-version";

/** help/version 优先；ui 与其他动作互斥，silent 为修饰选项。 */
export const META_ACTION_PRIORITY: Record<MetaAction, number> = {
  run: 0,
  profile: 1,
  pick: 2,
  setkey: 3,
  addmodel: 4,
  providerlist: 5,
  modellist: 6,
  generate: 7,
  migrate: 8,
  ui: 9,
  version: 10,
  help: 11,
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
  arg !== META_SILENT &&
  arg !== META_GENERATE &&
  arg !== META_MIGRATE &&
  arg !== META_UI &&
  !arg.startsWith(META_ACCOUNT_PREFIX) &&
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
      `  ${META_SILENT}          压制 output.* 输出（MCP/AI 调用避免污染）`,
      `  ${META_MIGRATE}         显式迁移 settings v1 → v2（先备份）`,
      `  ${META_UI}              浏览器编辑 settings v2，保存后自动重建`,
      `  ${META_ACCOUNT_PREFIX}<alias> 多账号 apiKey 更新时指定账号`,
      `  ${META_GENERATE}        从 settings.json 重新生成 profile.json`,
      `  ${META_APIKEY_PREFIX}<key>   更新指定提供商 apiKey（自动重建）`,
      `  ${META_MODELNAME_PREFIX}<name> 添加模型（自动重建）`,
      `  ${META_PROVIDER_PREFIX}<id>  显式指定 provider alias（供 apiKey/model-name 跳过选择）`,
      `  ${META_PROVIDER_LIST}     输出提供商列表（id + name）`,
      `  ${META_MODEL_LIST}        输出模型列表（name + 所属 provider）`,
      `  ${META_HELP}            显示本帮助`,
      `  ${META_VERSION}         显示版本`,
      "",
      "其余所有参数原样透传给 claude。",
      "优先级：help > version > ui > migrate > generate > model-list > provider-list > model-name > apiKey > pick > profile。",
      "--meta-ui 与其他 meta 动作和 provider/account 选择器互斥；help/version 优先，silent 可同用。",
      "UI 总会打印 URL；非 TTY 不自动打开浏览器。5 分钟超时或保存失败以非零码退出。",
      `配置: ${PROFILE_PATH}`,
      `源: ${SETTINGS_PATH}（--meta-generate 消费，provider 内嵌 models）`,
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
 * settings.json 无提供商 → 提示编辑 + exit(1)。与 pickProfile 行为对齐。
 */
export const selectProvider = async (pc: AnySettings): Promise<string> => {
  const ids = isSettingsV2(pc)
    ? pc.providers.map((p) => p.alias)
    : Object.keys(pc.providers);
  const labels = providerListLines(pc);
  if (ids.length === 0) {
    process.stderr.write(
      `settings.json 没有可用提供商，请先编辑 ${SETTINGS_PATH}。\n`,
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
    choices: ids.map((id, i) => ({
      title: labels[i],
      value: id,
    })),
  });

  return provider;
};

/** 多账号服务商不能猜账号；非 TTY 给出可脚本化的替代参数。 */
export const selectAccount = async (
  provider: SettingsProviderV2,
): Promise<string> => {
  if (!provider.accounts) throw new Error("单 apiKey 服务商没有可选账号");
  if (!resolveHandlerContext().interactive)
    throw new Error(
      "多账号服务商需要交互终端，请改用 --meta-account=<alias> 显式指定账号。",
    );
  const { account } = await xPrompts({
    type: "select",
    name: "account",
    message: "选择账号",
    choices: provider.accounts.map((a) => ({ title: a.alias, value: a.alias })),
  });
  return account;
};
