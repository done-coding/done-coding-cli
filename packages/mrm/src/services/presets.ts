import { homedir } from "node:os";
import { Protocol, ClientName, type Client, type Provider } from "@/types";

/** 内置 Client */
export const BUILTIN_CLIENTS: Client[] = [
  {
    name: ClientName.CLAUDE_CODE,
    protocol: Protocol.ANTHROPIC,
    configPath: `${homedir()}/.claude/settings.json`,
  },
  {
    name: ClientName.DONE_CODING_AI,
    protocol: Protocol.OPENAI,
    configPath: `${homedir()}/.done-coding/config.json`,
  },
];

/** 内置 Provider，按协议分组 */
export const BUILTIN_PROVIDERS_BY_PROTOCOL: Record<Protocol, Provider[]> = {
  [Protocol.ANTHROPIC]: [
    {
      alias: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "",
      models: ["haiku", "sonnet", "opus"],
      protocol: Protocol.ANTHROPIC,
      builtin: true,
    },
    {
      alias: "deepseek",
      baseUrl: "https://api.deepseek.com/anthropic",
      apiKey: "",
      models: [
        "deepseek-v4-pro[1m]",
        "deepseek-v4-flash[1m]",
        "deepseek-chat",
        "deepseek-reasoner",
      ],
      protocol: Protocol.ANTHROPIC,
      builtin: true,
    },
  ],

  [Protocol.OPENAI]: [
    {
      alias: "openai",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      models: ["gpt-4o", "gpt-4o-mini"],
      protocol: Protocol.OPENAI,
      builtin: true,
    },
    {
      alias: "deepseek",
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
      models: [
        "deepseek-v4-pro[1m]",
        "deepseek-v4-flash[1m]",
        "deepseek-chat",
        "deepseek-reasoner",
      ],
      protocol: Protocol.OPENAI,
      builtin: true,
    },
    {
      alias: "qwen",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
      apiKey: "",
      models: ["qwen-turbo", "qwen-plus", "qwen-max"],
      protocol: Protocol.OPENAI,
      builtin: true,
    },
    {
      alias: "kimi",
      baseUrl: "https://api.moonshot.cn",
      apiKey: "",
      models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
      protocol: Protocol.OPENAI,
      builtin: true,
    },
  ],
};

/** 每个 client 的默认状态（出厂设置，仅首次使用） */
export const DEFAULT_CLIENT_STATE: Record<
  string,
  { provider: string; model: string }
> = {
  [ClientName.CLAUDE_CODE]: { provider: "anthropic", model: "sonnet" },
  [ClientName.DONE_CODING_AI]: {
    provider: "deepseek",
    model: "deepseek-v4-pro[1m]",
  },
};

/** 获取 client 绑定的 protocol */
export function getClientProtocol(clientName: ClientName): Protocol {
  const client = BUILTIN_CLIENTS.find((c) => c.name === clientName);
  if (!client) throw new Error(`不支持的 client: ${clientName}`);
  return client.protocol;
}
