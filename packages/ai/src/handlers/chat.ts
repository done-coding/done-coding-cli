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
  MODEL_PRESETS,
  CUSTOM_PRESET_INDEX,
  CUSTOM_PRESET_LABEL,
} from "@/services/model-presets";
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
 * 首次引导流程：展示预设模型列表 → 用户选择（含自定义） → 输入 API Key
 * @returns AiConfig 配置对象，用户取消时返回 null
 */
const firstTimeSetup = async (): Promise<AiConfig | null> => {
  const choices = MODEL_PRESETS.map((p, i) => ({
    title: `${p.label} (${p.baseUrl})`,
    value: i,
  }));
  choices.push({ title: CUSTOM_PRESET_LABEL, value: CUSTOM_PRESET_INDEX });

  const { modelIndex } = await xPrompts({
    type: "select",
    name: "modelIndex",
    message: "选择大模型",
    choices,
  });

  let model: string;
  let baseUrl: string;

  if (modelIndex === CUSTOM_PRESET_INDEX) {
    const custom = await xPrompts([
      { type: "text", name: "model", message: "输入模型名" },
      { type: "text", name: "baseUrl", message: "输入 API Base URL" },
    ]);
    model = custom.model;
    baseUrl = custom.baseUrl;
  } else {
    model = MODEL_PRESETS[modelIndex].model;
    baseUrl = MODEL_PRESETS[modelIndex].baseUrl;
  }

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
    outputConsole.log("首次使用需配置模型和 API Key\n");
    const result = await firstTimeSetup();
    if (!result) return;

    aiConfig = result;
    config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
    await writeGlobalConfig(config);
    outputConsole.log("");
  }

  outputConsole.log(
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
      outputConsole.log("对话结束");
      return;
    }

    if (trimmed === ChatKeywordEnum.MODEL) {
      const result = await firstTimeSetup();
      if (result) {
        aiConfig = result;
        config[DoneCodingCliGlobalConfigKeyEnum.AI_CONFIG] = aiConfig;
        await writeGlobalConfig(config);
        outputConsole.log(`已切换至 ${aiConfig.model}\n`);
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
      outputConsole.error(`请求失败: ${error?.message || error}`);
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
