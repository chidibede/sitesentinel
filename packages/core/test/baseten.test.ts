import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BasetenProvider } from '../src/models/baseten.js';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn(),
  };
});

describe('BasetenProvider', () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    const MockedOpenAI = OpenAI as unknown as ReturnType<typeof vi.fn>;
    MockedOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));
  });

  it('should initialize with default config', () => {
    const provider = new BasetenProvider({
      apiKey: 'test-key',
    });

    expect(provider).toBeDefined();
    expect(OpenAI).toHaveBeenCalledWith({
      baseURL: 'https://inference.baseten.co/v1',
      apiKey: 'test-key',
    });
  });

  it('should use custom config', () => {
    new BasetenProvider({
      apiKey: 'test-key',
      model: 'custom-model',
      baseURL: 'https://custom.url',
    });

    expect(OpenAI).toHaveBeenCalledWith({
      baseURL: 'https://custom.url',
      apiKey: 'test-key',
    });
  });

  it('should generate completion with text message', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Test response',
            reasoning_content: 'Test reasoning',
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    });

    const provider = new BasetenProvider({ apiKey: 'test-key' });
    const response = await provider.generateCompletion([
      { role: 'user', content: 'Test prompt' },
    ]);

    expect(response).toEqual({
      content: 'Test response',
      reasoning: 'Test reasoning',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'meta-models/muse-spark-open-1026',
      messages: [{ role: 'user', content: 'Test prompt' }],
      max_completion_tokens: 4000,
      temperature: 0.7,
    });
  });

  it('should handle image content', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Image analysis',
          },
        },
      ],
    });

    const provider = new BasetenProvider({ apiKey: 'test-key' });
    await provider.generateCompletion([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this image' },
          { type: 'image_url', image_url: 'https://example.com/image.jpg' },
        ],
      },
    ]);

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'meta-models/muse-spark-open-1026',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image.jpg' },
            },
          ],
        },
      ],
      max_completion_tokens: 4000,
      temperature: 0.7,
    });
  });

  it('should handle custom options', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Response',
          },
        },
      ],
    });

    const provider = new BasetenProvider({ apiKey: 'test-key' });
    await provider.generateCompletion(
      [{ role: 'user', content: 'Test' }],
      {
        maxTokens: 2000,
        temperature: 0.5,
      }
    );

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'meta-models/muse-spark-open-1026',
      messages: [{ role: 'user', content: 'Test' }],
      max_completion_tokens: 2000,
      temperature: 0.5,
    });
  });

  it('should throw error when no choice returned', async () => {
    mockCreate.mockResolvedValue({
      choices: [],
    });

    const provider = new BasetenProvider({ apiKey: 'test-key' });

    await expect(
      provider.generateCompletion([{ role: 'user', content: 'Test' }])
    ).rejects.toThrow('No completion choice returned from Baseten');
  });

  it('should handle response without reasoning', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Simple response',
          },
        },
      ],
    });

    const provider = new BasetenProvider({ apiKey: 'test-key' });
    const response = await provider.generateCompletion([
      { role: 'user', content: 'Test' },
    ]);

    expect(response.content).toBe('Simple response');
    expect(response.reasoning).toBeUndefined();
  });

  it('should handle null content (reasoning-only response)', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            reasoning_content: 'Only reasoning',
          },
        },
      ],
    });

    const provider = new BasetenProvider({ apiKey: 'test-key' });
    const response = await provider.generateCompletion([
      { role: 'user', content: 'Test' },
    ]);

    expect(response.content).toBeNull();
    expect(response.reasoning).toBe('Only reasoning');
  });
});
