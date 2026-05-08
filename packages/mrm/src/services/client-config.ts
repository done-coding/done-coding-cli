import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { getAiConfigFilePath } from "@done-coding/cli-utils";
import { ClientName, type Protocol, type ClientState } from "@/types";
import { findProvider, getAllClients, resolveClientProtocol } from "./registry";

/**
 * 根据 clientState 写入对应 client 配置
 * - done-coding-ai → ~/.done-coding/ai/config.json（浅合并，保留已有字段）
 * - claude-code → ~/.claude/settings.json（浅合并，保留已有字段）
 * - 自定义 client → 用户指定的 configPath（浅合并，保留已有字段）
 */
export function writeClientConfig(
  clientName: string,
  state: ClientState,
): void {
  const client = getAllClients().find((c) => c.name === clientName);
  if (!client) throw new Error(`不支持的 client: ${clientName}`);

  const protocol = resolveClientProtocol(clientName);
  const provider = findProvider(protocol, state.provider);
  if (!provider) throw new Error(`服务商 "${state.provider}" 不存在`);

  if (client.builtin) {
    switch (client.name) {
      case ClientName.CLAUDE_CODE:
        writeClaudeCodeConfig(state.model, provider.baseUrl, provider.apiKey);
        break;
      case ClientName.DONE_CODING_AI:
        writeDoneCodingAiConfig({
          model: state.model,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          protocol,
        });
        break;
    }
  } else {
    writeGenericConfig(client.configPath, {
      model: state.model,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      protocol,
    });
  }
}

/** DeepSeek 等第三方服务商需要的额外 env key */
const THIRD_PARTY_ENV_KEYS = [
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "CLAUDE_CODE_SUBAGENT_MODEL",
  "API_TIMEOUT_MS",
  "CLAUDE_CODE_EFFORT_LEVEL",
];

function writeClaudeCodeConfig(
  model: string,
  baseUrl: string,
  apiKey: string,
): void {
  const configPath = `${homedir()}/.claude/settings.json`;
  const existing = readJsonFile(configPath);

  const env: Record<string, string> = {
    ...((existing.env as Record<string, string>) ?? {}),
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_API_KEY: apiKey,
  };

  const isThirdParty = baseUrl.includes("deepseek");

  if (isThirdParty) {
    env.ANTHROPIC_MODEL = model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
    env.CLAUDE_CODE_SUBAGENT_MODEL = model;
    env.API_TIMEOUT_MS = "3000000";
    env.CLAUDE_CODE_EFFORT_LEVEL = "max";
  } else {
    for (const key of THIRD_PARTY_ENV_KEYS) {
      delete env[key];
    }
  }

  const updated: Record<string, unknown> = {
    ...existing,
    model,
    env,
  };

  if (!isThirdParty) {
    delete updated.apiKeyHelper;
    delete updated.modelOverrides;
  }

  writeFile(configPath, updated);
}

function writeDoneCodingAiConfig(opts: {
  model: string;
  baseUrl: string;
  apiKey: string;
  protocol: Protocol;
}): void {
  const configPath = getAiConfigFilePath();
  const existing = readJsonFile(configPath);

  const updated: Record<string, unknown> = {
    ...existing,
    model: opts.model,
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    protocol: opts.protocol,
  };

  writeFile(configPath, updated);
}

function writeGenericConfig(
  configPath: string,
  data: Record<string, unknown>,
): void {
  const existing = existsSync(configPath) ? readJsonFile(configPath) : {};
  const updated = { ...existing, ...data };
  writeFile(configPath, updated);
}

function readJsonFile(path: string): Record<string, unknown> {
  try {
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function writeFile(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}
