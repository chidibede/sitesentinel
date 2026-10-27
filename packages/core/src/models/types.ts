/**
 * Model provider abstraction for SiteSentinel
 */

export interface ImageContent {
  type: 'image_url';
  image_url: string | { url: string };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = TextContent | ImageContent;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

export interface ModelResponse {
  content: string | null;
  reasoning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ModelProvider {
  generateCompletion(
    messages: Message[],
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<ModelResponse>;
}
