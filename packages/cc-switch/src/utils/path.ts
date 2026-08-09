import os from "node:os";
import path from "node:path";

/**
 * profile 配置文件唯一路径：~/.done-coding/cc-switch/profile.json
 * `~` 不写死具体用户，由 os.homedir() 解析当前用户 home。
 */
export const PROFILE_PATH = path.join(
  os.homedir(),
  ".done-coding",
  "cc-switch",
  "profile.json",
);

/** provider 源文件唯一路径：~/.done-coding/cc-switch/provider.json */
export const PROVIDER_PATH = path.join(
  os.homedir(),
  ".done-coding",
  "cc-switch",
  "provider.json",
);

/** model 源文件唯一路径：~/.done-coding/cc-switch/model.json */
export const MODEL_PATH = path.join(
  os.homedir(),
  ".done-coding",
  "cc-switch",
  "model.json",
);
