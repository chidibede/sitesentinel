import OpenAI from 'openai';
import type {
  ModelProvider,
  Message,
  ModelResponse,
  MessageContent,
} from './types.js';

export interface BasetenProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

/**
 * Baseten provider for Muse Spark Open (open-weights model)
 * Uses OpenAI-compatible API at https://inference.baseten.co/v1
 *
 * Note: Muse Spark Open always reasons first and returns both
 * reasoning_content and content. Use a generous max_tokens (e.g. 4000)
 * to ensure both reasoning and final answer are complete.
 */
export class BasetenProvider implements ModelProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: BasetenProviderConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL ?? 'https://inference.baseten.co/v1',
      apiKey: config.apiKey,
    });
    this.model = config.model ?? 'meta-models/muse-spark-open-1026';
  }

  async generateCompletion(
    messages: Message[],
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<ModelResponse> {
    const openAIMessages = messages.map((msg) => {
      const content = this.formatContent(msg.content);
      if (msg.role === 'user') {
        return { role: 'user' as const, content };
      } else if (msg.role === 'assistant') {
        return { role: 'assistant' as const, content: content as string };
      } else {
        return { role: 'system' as const, content: content as string };
      }
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openAIMessages,
      max_completion_tokens: options.maxTokens ?? 4000,
      temperature: options.temperature ?? 0.7,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No completion choice returned from Baseten');
    }

    // Extract reasoning if present (Muse Spark Open always reasons)
    const reasoning = (choice.message as { reasoning_content?: string })
      .reasoning_content;

    return {
      content: choice.message.content,
      reasoning,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  private formatContent(
    content: string | MessageContent[]
  ): string | OpenAI.Chat.ChatCompletionContentPart[] {
    if (typeof content === 'string') {
      return content;
    }

    return content.map((part) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text };
      } else {
        const imageUrl =
          typeof part.image_url === 'string'
            ? part.image_url
            : part.image_url.url;
        return {
          type: 'image_url' as const,
          image_url: { url: imageUrl },
        };
      }
    });
  }
}
