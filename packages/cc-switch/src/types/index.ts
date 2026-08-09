/** 单个 profile：可选描述 + env 注入键值 */
export interface Profile {
  describe?: string;
  env: Record<string, string>;
}

/**
 * profile 配置文件结构（~/.done-coding/cc-switch/profile.json，--meta-generate
 * 编译快照；运行时单源读取）。defaultProfile/disabledDefault/output 由
 * settings.json 编译携带，均可选。
 */
export interface ProfileConfig {
  /** 可选：未配置 / 被 disabledDefault 禁用 → 交互 pick */
  defaultProfile?: string;
  /** 忽略已配默认，强制交互选择（缺省 false） */
  disabledDefault?: boolean;
  /** 输出行为控制（缺省 profileName=true） */
  output?: { profileName?: boolean };
  profiles: Record<string, Profile>;
}

/** settings 源：模型（绑 provider，id 为该 provider 下局部标识 → profile 名 = `${provider}-${id}`） */
export interface SettingsModel {
  id: string;
  /** 实际模型串（如 deepseek-v4-flash[1m]） */
  name: string;
  /** 附加 env 覆盖（如 pro 档 ANTHROPIC_DEFAULT_HAIKU_MODEL 用 flash） */
  envExtraParams?: Record<string, string>;
}

/** settings 源：服务商（内嵌支持的模型；url/apiKey 单点） */
export interface SettingsProvider {
  /** 展示名（服务商名） */
  name: string;
  url: string;
  apiKey: string;
  /** 附加 env（如 CLAUDE_CODE_EFFORT_LEVEL=max），合并序 model > provider > 通用 */
  envExtraParams?: Record<string, string>;
  models: SettingsModel[];
}

/**
 * settings 配置文件结构（~/.done-coding/cc-switch/settings.json，唯一源，
 * 含 apiKey → chmod 600）。注意与 env-guard 的 SETTINGS_PATH
 * （~/.claude/settings.json，Claude Code 自身配置）同名不同物。
 */
export interface Settings {
  defaultProfile?: string;
  disabledDefault?: boolean;
  output?: { profileName?: boolean };
  providers: Record<string, SettingsProvider>;
}

/** meta 动作：run=透传启动 / profile=显式指定 / pick=交互选择 / setkey=改 provider key /
 *  addmodel=添加模型 / providerlist=列提供商 / modellist=列模型 / generate=重建配置 / help / version */
export type MetaAction =
  | "run"
  | "profile"
  | "pick"
  | "setkey"
  | "addmodel"
  | "providerlist"
  | "modellist"
  | "generate"
  | "help"
  | "version";

/** argv 解析结果：meta 动作归并 + 消费的各 meta 值 + 其余原样透传 */
export interface ParsedArgv {
  action: MetaAction;
  profileName?: string;
  /** --meta-apiKey= 值（setkey 消费） */
  apiKey?: string;
  /** --meta-model-name= 值（addmodel 消费） */
  modelName?: string;
  /** --meta-provider= 值（setkey/addmodel 的 provider 选择旁路，非独立动作） */
  providerId?: string;
  /** --meta-silent：压制 output.* 输出（MCP/AI 调用避免污染上下文） */
  silent: boolean;
  passthrough: string[];
}
