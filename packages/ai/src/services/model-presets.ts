import type { AiConfig } from "@done-coding/cli-utils";

/** 预设模型条目（继承 AiConfig 配置字段，附加展示标签） */
export type ModelPreset = {
  /** 用户可见的展示名称 */
  label: string;
} & AiConfig;

/** 自定义模型选项的索引值 */
export const CUSTOM_PRESET_INDEX = -1;

/** 自定义模型的展示标签文本 */
export const CUSTOM_PRESET_LABEL = "自定义...";

/** 预设模型列表（不含 apiKey，用户需自行输入） */
export const MODEL_PRESETS: ModelPreset[] = [
  {
    label: "DeepSeek V3",
    model: "deepseek-chat",
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
  },
  {
    label: "通义千问",
    model: "qwen-turbo",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
  },
  {
    label: "Kimi",
    model: "moonshot-v1-8k",
    apiKey: "",
    baseUrl: "https://api.moonshot.cn",
  },
  {
    label: "Groq",
    model: "llama-3.3-70b",
    apiKey: "",
    baseUrl: "https://api.groq.com/openai",
  },
];
