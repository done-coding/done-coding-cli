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

/** provider：服务商层（url/apiKey 单点 + 可选附加 env，供 --meta-generate 消费） */
export interface Provider {
  /** 展示名（服务商名） */
  name: string;
  url: string;
  apiKey: string;
  /** 附加 env（如 CLAUDE_CODE_EFFORT_LEVEL=max），合并序 model > provider > 通用 */
  envExtraParams?: Record<string, string>;
}

/** provider 配置文件结构（~/.done-coding/cc-switch/provider.json） */
export interface ProviderConfig {
  providers: Record<string, Provider>;
}

/** model：模型层（绑 provider，id 为该 provider 下局部标识 → profile 名 = `${provider}-${id}`） */
export interface Model {
  provider: string;
  id: string;
  /** 实际模型串（如 deepseek-v4-flash[1m]） */
  name: string;
  /** 附加 env 覆盖（如 pro 档 ANTHROPIC_DEFAULT_HAIKU_MODEL 用 flash） */
  envExtraParams?: Record<string, string>;
}

/** model 配置文件结构（~/.done-coding/cc-switch/model.json，defaultProfile 为生成后 profile 名） */
export interface ModelConfig {
  defaultProfile: string;
  models: Model[];
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
  passthrough: string[];
}
