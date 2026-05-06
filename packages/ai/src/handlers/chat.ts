import type {
  SubCliInfo,
  DoneCodingCliGlobalConfig,
  AiConfig,
} from "@done-coding/cli-utils";
import {
  outputConsole,
  chalk,
  xPrompts,
  readJsonFileAsync,
  getGlobalConfigFilePath,
  DoneCodingCliGlobalConfigKeyEnum,
  execSyncHijack,
} from "@done-coding/cli-utils";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ChatKeywordEnum, SubcommandEnum } from "@/types";
import { AuthenticationError } from "openai";
import { streamChat } from "@/services/api-client";
import {
  ClientName,
  Protocol,
  readRegistry,
  getProviders,
  findProvider,
  switchProvider,
  switchModel,
  writeClientConfig,
  setProviderApiKey,
} from "@done-coding/cli-mrm";

const AI_CLIENT = ClientName.DONE_CODING_AI;
const AI_PROTOCOL = Protocol.OPENAI;

/** 子包名 → bin 命令映射（排除 ai、cli、git） */
const SUBPACKAGE_HELP_MAP: Record<string, string> = {
  mrm: "dc-mrm",
  component: "dc-component",
  config: "dc-config",
  create: "create-done-coding",
  extract: "dc-extract",
  inject: "dc-inject",
  publish: "dc-publish",
  template: "dc-template",
};

/**
 * 读取全局配置文件
 */
const readGlobalConfig = async (): Promise<DoneCodingCliGlobalConfig> => {
  try {
    return await readJsonFileAsync<DoneCodingCliGlobalConfig>(
      getGlobalConfigFilePath(),
    );
  } catch {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {} as DoneCodingCliGlobalConfig;
  }
};

/**
 * 写入全局配置文件（目录不存在时自动创建）
 */
const writeGlobalConfig = async (config: DoneCodingCliGlobalConfig) => {
  const filePath = getGlobalConfigFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
};

/**
 * 确保 apiKey 不为空：读 config → 为空则 xPrompts 输入 → setProviderApiKey + writeClientConfig
 */
const ensureApiKey = async (
  protocol: Protocol,
  providerAlias: string,
): Promise<string> => {
  const config = await readGlobalConfig();
  const aiConfig = config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG];
  if (aiConfig?.apiKey) return aiConfig.apiKey;

  outputConsole.info("");
  const { apiKey } = await xPrompts({
    type: "password",
    name: "apiKey",
    message: "输入 API Key",
    validate: (v: string) => (v?.trim().length > 0 ? true : "API Key 不能为空"),
  });

  setProviderApiKey(protocol, providerAlias, apiKey);
  const registry = readRegistry();
  const state = registry.clientState[AI_CLIENT];
  writeClientConfig(AI_CLIENT, state);
  return apiKey;
};

/**
 * /provider 处理：列出 OPENAI 协议服务商 → 选择 → 切换
 */
const handleProviderSwitch = async () => {
  const providers = getProviders(AI_PROTOCOL);
  if (providers.length === 0) {
    outputConsole.info("暂无可用服务商，请先用 dc-mrm provider add 添加");
    return;
  }

  const choices = providers.map((p, i) => ({
    title: p.alias + (p.builtin ? " [内置]" : ""),
    value: i,
  }));

  const { providerIndex } = await xPrompts({
    type: "select",
    name: "providerIndex",
    message: "选择服务商",
    choices,
  });

  const provider = providers[providerIndex];
  try {
    const state = switchProvider(AI_CLIENT, provider.alias);
    writeClientConfig(AI_CLIENT, state);
    outputConsole.info(`已切换服务商 → ${state.provider} → ${state.model}`);
    await ensureApiKey(AI_PROTOCOL, provider.alias);
  } catch (e: any) {
    outputConsole.error(e.message);
  }
};

/**
 * /model 处理：列当前服务商模型 → 选择 → 切换
 */
const handleModelSwitch = async () => {
  const registry = readRegistry();
  const state = registry.clientState[AI_CLIENT];
  if (!state?.provider) {
    outputConsole.info("未配置服务商，请先用 /provider 选择");
    return;
  }

  const provider = findProvider(AI_PROTOCOL, state.provider);
  if (!provider || provider.models.length === 0) {
    outputConsole.info(`服务商 "${state.provider}" 下暂无模型`);
    return;
  }

  const choices = provider.models.map((m, i) => ({
    title: m + (i === 0 ? " (默认)" : ""),
    value: i,
  }));

  const { modelIndex } = await xPrompts({
    type: "select",
    name: "modelIndex",
    message: `选择 ${state.provider} 模型`,
    choices,
  });

  const modelName = provider.models[modelIndex];
  try {
    const newState = switchModel(AI_CLIENT, modelName);
    writeClientConfig(AI_CLIENT, newState);
    outputConsole.info(`已切换模型 → ${newState.model}`);
    await ensureApiKey(AI_PROTOCOL, state.provider);
  } catch (e: any) {
    outputConsole.error(e.message);
  }
};

/**
 * /xxx 子包帮助处理
 */
const handleSubpackageHelp = (input: string): boolean => {
  const name = input.slice(1).trim();
  const bin = SUBPACKAGE_HELP_MAP[name];
  if (!bin) return false;

  outputConsole.info(chalk.yellow("当前相关cli未完全ai工具化，敬请期待。"));
  outputConsole.info(chalk.cyan("以下是其版本及使用帮助：\n"));

  const runBin = (args: string) => {
    try {
      return execSyncHijack(`${bin} ${args}`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      });
    } catch {
      // 开发环境 fallback：cwd 向下找 node_modules/.bin/<bin>
      const fallback = `${process.cwd()}/node_modules/.bin/${bin}`;
      return execSyncHijack(`${fallback} ${args}`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      });
    }
  };

  try {
    const version = runBin("--version");
    outputConsole.info(
      chalk.green(`版本: ${(version as Buffer).toString().trim()}\n`),
    );
  } catch {
    // 版本获取失败不阻塞
  }

  try {
    const help = runBin("--help");
    outputConsole.info((help as Buffer).toString());
  } catch {
    outputConsole.error(`无法获取 ${name} 帮助信息`);
  }
  return true;
};

/**
 * 首次引导流程：用 mrm registry 选服务商 → 选模型 → 输入 apiKey
 */
const firstTimeSetup = async (): Promise<AiConfig | null> => {
  const providers = getProviders(AI_PROTOCOL);
  if (providers.length === 0) {
    outputConsole.info("暂无可用服务商");
    return null;
  }

  const providerChoices = providers.map((p, i) => ({
    title: p.alias + (p.builtin ? " [内置]" : ""),
    value: i,
  }));

  const { providerIndex } = await xPrompts({
    type: "select",
    name: "providerIndex",
    message: "首次使用，选择模型服务商",
    choices: providerChoices,
  });

  const provider = providers[providerIndex];

  const modelChoices = provider.models.map((m, i) => ({
    title: m,
    value: i,
  }));

  const { modelIndex } = await xPrompts({
    type: "select",
    name: "modelIndex",
    message: `选择 ${provider.alias} 模型`,
    choices: modelChoices,
  });

  const model = provider.models[modelIndex];

  const { apiKey } = await xPrompts({
    type: "password",
    name: "apiKey",
    message: "输入 API Key",
    validate: (v: string) => (v?.trim().length > 0 ? true : "API Key 不能为空"),
  });

  // 通过 mrm 写入
  setProviderApiKey(AI_PROTOCOL, provider.alias, apiKey);
  const state = switchModel(AI_CLIENT, model);
  writeClientConfig(AI_CLIENT, state);

  return { model, baseUrl: provider.baseUrl, apiKey };
};

/**
 * AI 对话主处理器
 */
const chatHandler = async () => {
  let config = await readGlobalConfig();
  let aiConfig = config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG];

  // 首次配置
  if (!aiConfig?.apiKey) {
    outputConsole.info("首次使用需配置模型和 API Key\n");
    const result = await firstTimeSetup();
    if (!result) return;

    aiConfig = result;
    config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
    await writeGlobalConfig(config);
    outputConsole.info("");
  }

  outputConsole.info(
    `模型: ${aiConfig.model} | 输入消息开始对话 (${ChatKeywordEnum.EXIT} 退出, ${ChatKeywordEnum.PROVIDER} 切换服务商, ${ChatKeywordEnum.MODEL} 切换模型, ${ChatKeywordEnum.CLEAR} 清屏)\n`,
  );

  // 对话循环
  while (true) {
    const { input } = await xPrompts({
      type: "text",
      name: "input",
      message: "",
      validate: () => true,
    });

    const trimmed = (input as string)?.trim();

    if (!trimmed) continue;

    if (trimmed === ChatKeywordEnum.EXIT) {
      outputConsole.info("对话结束");
      return;
    }

    if (trimmed === ChatKeywordEnum.PROVIDER) {
      await handleProviderSwitch();
      // 重新加载 config（mrm 已更新）
      config = await readGlobalConfig();
      aiConfig = config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG];
      continue;
    }

    if (trimmed === ChatKeywordEnum.MODEL) {
      await handleModelSwitch();
      config = await readGlobalConfig();
      aiConfig = config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG];
      continue;
    }

    if (trimmed === ChatKeywordEnum.CLEAR) {
      process.stdout.write("\x1b[2J\x1b[0f");
      continue;
    }

    // /xxx 子包帮助
    if (trimmed.startsWith("/") && handleSubpackageHelp(trimmed)) {
      continue;
    }

    // 发送 AI 请求
    outputConsole.stage("思考中...");
    try {
      await streamChat({
        config: aiConfig!,
        message: trimmed,
        onToken: (token) => process.stdout.write(token),
      });
      process.stdout.write("\n");
    } catch (error: any) {
      const isAuthError =
        error instanceof AuthenticationError || error?.status === 401;
      if (isAuthError) {
        outputConsole.info("API Key 无效，请重新输入\n");
        const state = readRegistry().clientState[AI_CLIENT];
        if (state?.provider) {
          setProviderApiKey(AI_PROTOCOL, state.provider, "");
          await ensureApiKey(AI_PROTOCOL, state.provider);
        }
        config = await readGlobalConfig();
        aiConfig = config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG];
      } else {
        outputConsole.error(`请求失败: ${error?.message || error}`);
      }
    }
  }
};

/** yargs 子命令注册信息 */
export const commandCliInfo: SubCliInfo = {
  command: SubcommandEnum.CHAT,
  describe: "AI 对话",
  handler: chatHandler as SubCliInfo["handler"],
};

export const handler = chatHandler;
