import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "@done-coding/cli-utils";
import { Protocol } from "@done-coding/cli-mrm";

/** 流式聊天请求参数 */
export interface StreamChatParams {
  /** AI 配置 */
  config: AiConfig;
  /** 用户消息 */
  message: string;
  /** token 回调 */
  onToken: (token: string) => void;
}

/** SSE 流式聊天：OpenAI 协议 */
const streamChatOpenAI = async (params: StreamChatParams): Promise<void> => {
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

/** SSE 流式聊天：Anthropic 协议 */
const streamChatAnthropic = async (params: StreamChatParams): Promise<void> => {
  const { config, message, onToken } = params;

  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const stream = client.messages.stream({
    model: config.model,
    max_tokens: 4096,
    messages: [{ role: "user", content: message }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onToken(event.delta.text);
    }
  }
};

/** SSE 流式聊天：按协议路由 */
export const streamChat = async (params: StreamChatParams): Promise<void> => {
  if (params.config.protocol === Protocol.ANTHROPIC) {
    return streamChatAnthropic(params);
  }
  return streamChatOpenAI(params);
};
