import type {
  SubCliInfo,
  DoneCodingCliGlobalConfig,
  AiConfig,
} from "@done-coding/cli-utils";
import {
  outputConsole,
  xPrompts,
  readJsonFileAsync,
  getGlobalConfigFilePath,
  DoneCodingCliGlobalConfigKeyEnum,
} from "@done-coding/cli-utils";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SubcommandEnum, ChatKeywordEnum } from "@/types";
import {
  PROVIDER_PRESETS,
  CUSTOM_PROVIDER_INDEX,
  CUSTOM_PROVIDER_LABEL,
} from "@/services/model-presets";
import { AuthenticationError } from "openai";
import { streamChat } from "@/services/api-client";

/**
 * 读取全局配置文件
 * @returns 全局配置对象，文件不存在时返回空对象
 */
const readGlobalConfig = async (): Promise<DoneCodingCliGlobalConfig> => {
  try {
    return await readJsonFileAsync<DoneCodingCliGlobalConfig>(
      getGlobalConfigFilePath(),
      {} as DoneCodingCliGlobalConfig,
    );
  } catch {
    return {} as DoneCodingCliGlobalConfig;
  }
};

/**
 * 写入全局配置文件（目录不存在时自动创建）
 * @param config 全局配置对象
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
 * 首次引导流程：
 * 1. 选择模型服务商（含自定义）
 * 2. 选择该服务商下的具体模型
 * 3. 输入 API Key
 * @returns AiConfig 配置对象，用户取消时返回 null
 */
const firstTimeSetup = async (): Promise<AiConfig | null> => {
  // Step 1: 选择服务商
  const providerChoices = PROVIDER_PRESETS.map((p, i) => ({
    title: p.label,
    value: i,
  }));
  providerChoices.push({
    title: CUSTOM_PROVIDER_LABEL,
    value: CUSTOM_PROVIDER_INDEX,
  });

  const { providerIndex } = await xPrompts({
    type: "select",
    name: "providerIndex",
    message: "选择模型服务商",
    choices: providerChoices,
  });

  let model: string;
  let baseUrl: string;

  if (providerIndex === CUSTOM_PROVIDER_INDEX) {
    // 自定义：手填模型名 + baseUrl
    const custom = await xPrompts([
      { type: "text", name: "model", message: "输入模型标识名" },
      { type: "text", name: "baseUrl", message: "输入 API Base URL" },
    ]);
    model = custom.model;
    baseUrl = custom.baseUrl;
  } else {
    const provider = PROVIDER_PRESETS[providerIndex];
    baseUrl = provider.baseUrl;

    // Step 2: 选择该服务商下的模型
    const modelChoices = provider.models.map((m, i) => ({
      title: m.label,
      value: i,
    }));

    const { modelIndex } = await xPrompts({
      type: "select",
      name: "modelIndex",
      message: `选择 ${provider.label} 模型`,
      choices: modelChoices,
    });

    model = provider.models[modelIndex].model;
  }

  // Step 3: 输入 API Key
  const { apiKey } = await xPrompts({
    type: "password",
    name: "apiKey",
    message: "输入 API Key",
    validate: (v: string) => (v?.trim().length > 0 ? true : "API Key 不能为空"),
  });

  return { model, apiKey, baseUrl };
};

/**
 * AI 对话主处理器
 * 流程：读取配置 → 首次引导（如需） → 对话循环（xPrompts 交互 + SSE 流式响应）
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
    `模型: ${aiConfig.model} | 输入消息开始对话 (${ChatKeywordEnum.EXIT} 退出, ${ChatKeywordEnum.MODEL} 切换模型, ${ChatKeywordEnum.CLEAR} 清屏)\n`,
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

    if (trimmed === ChatKeywordEnum.MODEL) {
      const result = await firstTimeSetup();
      if (result) {
        aiConfig = result;
        config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
        await writeGlobalConfig(config);
        outputConsole.info(`已切换至 ${aiConfig.model}\n`);
      }
      continue;
    }

    if (trimmed === ChatKeywordEnum.CLEAR) {
      process.stdout.write("\x1b[2J\x1b[0f");
      continue;
    }

    // 发送 AI 请求
    outputConsole.stage("思考中...");
    try {
      await streamChat({
        config: aiConfig,
        message: trimmed,
        onToken: (token) => process.stdout.write(token),
      });
      process.stdout.write("\n");
    } catch (error: any) {
      const isAuthError =
        error instanceof AuthenticationError || error?.status === 401;
      if (isAuthError) {
        outputConsole.info("API Key 无效，请重新输入\n");
        const result = await firstTimeSetup();
        if (!result) return;
        aiConfig = result;
        config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
        await writeGlobalConfig(config);
        outputConsole.info(`已切换至 ${aiConfig.model}\n`);
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
