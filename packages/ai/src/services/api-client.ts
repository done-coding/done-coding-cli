import OpenAI from "openai";
import type { AiConfig } from "@done-coding/cli-utils";

/** 流式聊天请求参数 */
export interface StreamChatParams {
  /** AI 配置 */
  config: AiConfig;
  /** 用户消息 */
  message: string;
  /** token 回调 */
  onToken: (token: string) => void;
}

/** SSE 流式聊天：逐 token 回调 onToken */
export const streamChat = async (params: StreamChatParams): Promise<void> => {
  const { config, message, onToken } = params;

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl.endsWith("/v1")
      ? config.baseUrl
      : config.baseUrl + "/v1",
  });

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: message }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onToken(content);
    }
  }
};
