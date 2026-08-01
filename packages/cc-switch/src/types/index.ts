/** 单个 profile：可选描述 + env 注入键值 */
export interface Profile {
  describe?: string;
  env: Record<string, string>;
}

/** profile 配置文件结构（~/.done-coding/cc-switch/profile.json） */
export interface ProfileConfig {
  defaultProfile: string;
  profiles: Record<string, Profile>;
}

/** meta 动作：run=透传启动 / profile=显式指定 / pick=交互选择 / help / version */
export type MetaAction = "run" | "profile" | "pick" | "help" | "version";

/** argv 解析结果：meta 动作归并 + 消费的 --meta-profile + 其余原样透传 */
export interface ParsedArgv {
  action: MetaAction;
  profileName?: string;
  passthrough: string[];
}
