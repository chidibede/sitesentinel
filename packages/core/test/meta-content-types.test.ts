/**
 * Meta Model API Content Type Tests
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetaModelAPIProvider } from '../src/models/meta-model-api.js';

describe('Meta Model API Content Types', () => {
  let provider: MetaModelAPIProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    provider = new MetaModelAPIProvider({
      apiKey: 'test-key',
      baseURL: 'https://api.meta.ai/v1',
    });
  });

  it('should send input_text and input_image content types for Muse Spark', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Test response',
              },
            ],
          },
        ],
      }),
    });

    await provider.generateCompletion([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Test prompt' },
          { type: 'input_image', image_url: 'data:image/jpeg;base64,test' },
        ],
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.meta.ai/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      })
    );

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const requestOptions = callArgs?.[1] as { body?: string };
    expect(requestOptions.body).toBeDefined();
    
    interface RequestBody {
      input: Array<{
        type: string;
        role: string;
        content: Array<{
          type: string;
          text?: string;
          image_url?: string;
        }>;
      }>;
    }
    
    const requestBody = JSON.parse(requestOptions.body ?? '{}') as RequestBody;

    // Verify content types
    expect(requestBody.input).toHaveLength(1);
    expect(requestBody.input[0]?.type).toBe('message');
    expect(requestBody.input[0]?.role).toBe('user');
    expect(requestBody.input[0]?.content).toHaveLength(2);
    expect(requestBody.input[0]?.content[0]?.type).toBe('input_text');
    expect(requestBody.input[0]?.content[0]?.text).toBe('Test prompt');
    expect(requestBody.input[0]?.content[1]?.type).toBe('input_image');
    expect(requestBody.input[0]?.content[1]?.image_url).toBe('data:image/jpeg;base64,test');
  });

  it('should not send text or image_url types (Baseten format) to Meta API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Test' }],
          },
        ],
      }),
    });

    await provider.generateCompletion([
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Prompt' },
          { type: 'input_image', image_url: 'data:image/jpeg;base64,test' },
        ],
      },
    ]);

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const requestOptions = callArgs?.[1] as { body?: string };
    
    interface RequestBody {
      input: Array<{
        content: Array<{ type: string }>;
      }>;
    }
    
    const requestBody = JSON.parse(requestOptions.body ?? '{}') as RequestBody;
    const content = requestBody.input[0]?.content ?? [];

    // Should NOT have 'text' or 'image_url' as types
    expect(content.every((c) => c.type !== 'text')).toBe(true);
    expect(content.every((c) => c.type !== 'image_url')).toBe(true);

    // Should have Meta types
    expect(content.some((c) => c.type === 'input_text')).toBe(true);
    expect(content.some((c) => c.type === 'input_image')).toBe(true);
  });

  it('should send correct SAM 3.1 request format', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '<0f>1<|box;x1=100;y1=100;x2=200;y2=200;w=100;h=100|><|mask;x=100;y=100;data=100,100,base64data|>',
              },
            ],
          },
        ],
      }),
    });

    await provider.segmentImage('data:image/jpeg;base64,test', 'hard hat');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.meta.ai/v1/responses',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    const requestOptions = callArgs?.[1] as { body?: string };
    
    interface RequestBody {
      model: string;
      input: Array<{
        content: Array<{
          type: string;
          text?: string;
          image_url?: string;
        }>;
      }>;
    }
    
    const requestBody = JSON.parse(requestOptions.body ?? '{}') as RequestBody;

    expect(requestBody.model).toBe('sam-3.1');
    expect(requestBody.input).toHaveLength(1);
    expect(requestBody.input[0]?.content).toHaveLength(2);
    expect(requestBody.input[0]?.content[0]?.type).toBe('input_text');
    expect(requestBody.input[0]?.content[0]?.text).toBe('hard hat');
    expect(requestBody.input[0]?.content[1]?.type).toBe('input_image');
  });
});
