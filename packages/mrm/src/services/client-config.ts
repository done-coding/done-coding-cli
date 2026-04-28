import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { readJsonFile } from "@done-coding/cli-utils";
import {
  ClientName,
  type ClientState,
  type ClaudeCodeSettings,
  type DoneCodingAiGlobalConfig,
} from "@/types";
import { findProvider } from "./registry";
import { BUILTIN_CLIENTS } from "./presets";

/** 根据 clientState 写入对应 client 配置 */
export function writeClientConfig(
  clientName: string,
  state: ClientState,
): void {
  const client = BUILTIN_CLIENTS.find((c) => c.name === clientName);
  if (!client) throw new Error(`不支持的 client: ${clientName}`);

  const provider = findProvider(client.protocol, state.provider);
  if (!provider) throw new Error(`服务商 "${state.provider}" 不存在`);

  switch (client.name) {
    case ClientName.CLAUDE_CODE:
      writeClaudeCodeConfig(state.model, provider.baseUrl, provider.apiKey);
      break;
    case ClientName.DONE_CODING_AI:
      writeDoneCodingAiConfig(state.model, provider.baseUrl, provider.apiKey);
      break;
  }
}

function writeClaudeCodeConfig(
  model: string,
  baseUrl: string,
  apiKey: string,
): void {
  const configPath = `${homedir()}/.claude/settings.json`;
  const existing = readJsonFile<ClaudeCodeSettings>(configPath, {})!;

  const env: Record<string, string> = {
    ...(existing.env ?? {}),
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_API_KEY: apiKey,
  };

  /** DeepSeek 走 anthropic 协议需要额外的模型指向 */
  if (baseUrl.includes("deepseek")) {
    env.ANTHROPIC_MODEL = model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
    env.CLAUDE_CODE_SUBAGENT_MODEL = model;
    env.API_TIMEOUT_MS = "3000000";
    env.CLAUDE_CODE_EFFORT_LEVEL = "max";
  }

  const updated: ClaudeCodeSettings = {
    ...existing,
    model,
    env,
  };
  writeFile(configPath, updated);
}

function writeDoneCodingAiConfig(
  model: string,
  baseUrl: string,
  apiKey: string,
): void {
  const configPath = `${homedir()}/.done-coding/config.json`;
  const existing = readJsonFile<DoneCodingAiGlobalConfig>(configPath, {})!;
  const updated: DoneCodingAiGlobalConfig = {
    ...existing,
    AI_CONFIG: {
      model,
      baseUrl,
      apiKey,
    },
  };
  writeFile(configPath, updated);
}

function writeFile(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}
