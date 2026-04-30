/** API 协议方案 */
export enum Protocol {
  ANTHROPIC = "anthropic",
  OPENAI = "openai",
}

/** 客户端名称 */
export enum ClientName {
  CLAUDE_CODE = "claude-code",
  DONE_CODING_AI = "done-coding-ai",
}

/** 子命令枚举 */
export enum SubcommandEnum {
  LS = "ls",
  USE = "use",
  SWITCH = "switch",
  PROVIDER_ADD = "provider add",
  PROVIDER_USE = "provider use",
  PROVIDER_REMOVE = "provider remove",
  MODEL_ADD = "model add",
  MODEL_REMOVE = "model remove",
  MODEL_USE = "model use",
}

/** 客户端 */
export interface Client {
  name: ClientName;
  protocol: Protocol;
  /** 配置文件绝对路径，运行时 homedir 解析 */
  configPath: string;
}

/** 服务商 */
export interface Provider {
  /** 服务商别名，同协议下唯一 */
  alias: string;
  /** API 端点 */
  baseUrl: string;
  /** 认证密钥 */
  apiKey: string;
  /** 支持的模型列表 */
  models: string[];
  /** 所属协议 */
  protocol: Protocol;
  /** 是否内置（内置不可删除） */
  builtin: boolean;
}

/** 每个 client 的状态 */
export interface ClientState {
  /** 当前服务商 alias */
  provider: string;
  /** 当前模型名 */
  model: string;
}

/** 注册表 */
export interface Registry {
  /** 当前 client 名 */
  currentClient: string;
  /** 各 client 状态 */
  clientState: Record<string, ClientState>;
  /** 服务商按协议分组，多 client 共享 */
  providers: Record<Protocol, Provider[]>;
}

/** ===== Client 配置文件类型 ===== */

/** Claude Code 配置文件结构（仅列 mrm 关注的字段） */
export interface ClaudeCodeSettings {
  model?: string;
  env?: ClaudeCodeEnv;
  apiKeyHelper?: string;
  modelOverrides?: Record<string, string>;
}

export interface ClaudeCodeEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  CLAUDE_CODE_SUBAGENT_MODEL?: string;
  API_TIMEOUT_MS?: string;
  CLAUDE_CODE_EFFORT_LEVEL?: string;
  [key: string]: string | undefined;
}

/** done-coding-ai 全局配置文件结构 */
export interface DoneCodingAiGlobalConfig {
  AI_CONFIG?: {
    model: string;
    apiKey: string;
    baseUrl: string;
  };
  [key: string]: unknown;
}

/** ===== Options 接口 ===== */

export interface LsOptions {
  view?: "model" | "provider";
}

export interface SwitchOptions {
  client: string;
}

export interface ProviderAddOptions {
  alias: string;
  url: string;
}

export interface ProviderUseOptions {
  alias: string;
}

export interface ProviderRemoveOptions {
  alias: string;
}

export interface ModelAddOptions {
  providerAlias: string;
  modelName: string;
}

export interface ModelRemoveOptions {
  providerAlias: string;
  modelName: string;
}

export interface ModelUseOptions {
  model: string;
  provider?: string;
}
