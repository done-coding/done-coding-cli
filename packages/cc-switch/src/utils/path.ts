import os from "node:os";
import path from "node:path";

/**
 * profile 配置文件唯一路径：~/.done-coding/cc-switch/profile.json
 * （--meta-generate 编译快照，运行时单源读取）。
 * `~` 不写死具体用户，由 os.homedir() 解析当前用户 home。
 */
export const PROFILE_PATH = path.join(
  os.homedir(),
  ".done-coding",
  "cc-switch",
  "profile.json",
);

/**
 * settings 源文件唯一路径：~/.done-coding/cc-switch/settings.json
 * （唯一源：providers 嵌套 models + defaultProfile/disabledDefault/output）。
 * 注意：与 Claude Code 的 ~/.claude/settings.json（env-guard SETTINGS_PATH）
 * 同名不同物，勿混淆。
 */
export const SETTINGS_PATH = path.join(
  os.homedir(),
  ".done-coding",
  "cc-switch",
  "settings.json",
);
