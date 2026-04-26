/**
 * 模型服务商预设
 * ---
 * 两级结构：先选服务商（含 baseUrl），再选该服务商下的具体模型
 */

/** 模型信息 */
export interface ModelInfo {
  /** 模型标识名（API 调用传参），如 "deepseek-chat" */
  model: string;
  /** 用户可见的展示名称 */
  label: string;
}

/** 服务商预设 */
export interface ProviderPreset {
  /** 服务商展示名称 */
  label: string;
  /** API Base URL */
  baseUrl: string;
  /** 该服务商下可用模型列表 */
  models: ModelInfo[];
}

/** 自定义服务商的索引值 */
export const CUSTOM_PROVIDER_INDEX = -1;

/** 自定义服务商的展示标签 */
export const CUSTOM_PROVIDER_LABEL = "自定义...";

/** 预设服务商列表 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: [
      { model: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { model: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      {
        model: "deepseek-chat",
        label: "DeepSeek V3 (chat，将于 2026/07/24 弃用)",
      },
      {
        model: "deepseek-reasoner",
        label: "DeepSeek R1 (reasoner，将于 2026/07/24 弃用)",
      },
    ],
  },
  {
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    models: [
      { model: "qwen-turbo", label: "Qwen Turbo" },
      { model: "qwen-plus", label: "Qwen Plus" },
      { model: "qwen-max", label: "Qwen Max" },
    ],
  },
  {
    label: "Kimi (月之暗面)",
    baseUrl: "https://api.moonshot.cn",
    models: [
      { model: "moonshot-v1-8k", label: "Moonshot v1 8K" },
      { model: "moonshot-v1-32k", label: "Moonshot v1 32K" },
      { model: "moonshot-v1-128k", label: "Moonshot v1 128K" },
    ],
  },
  {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai",
    models: [
      { model: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { model: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ],
  },
];
