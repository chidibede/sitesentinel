/**
 * Meta Model API provider for SAM 3.1, Muse Spark, and Muse Voice Transcribe
 *
 * Verified API Details (2026-10-28):
 * - Base URL: https://api.meta.ai/v1
 * - Auth: Bearer token via META_API_KEY
 * - Models: sam-3.1, muse-spark-1.3, muse-voice-transcribe-1.0
 *
 * POST /v1/responses with OpenAI-compatible input format
 * SAM returns special token strings with boxes and masks
 * Muse Spark returns output array with reasoning and message items
 */

export interface MetaModelAPIConfig {
  apiKey: string;
  baseURL?: string;
}

export interface BoundingBox {
  objectId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export interface MaskData {
  x: number;
  y: number;
  width: number;
  height: number;
  data: string; // Encoded mask data
}

export interface SAMDetection {
  objectId: number;
  box: BoundingBox;
  mask: MaskData;
}

export interface SAMSegmentationResult {
  concept: string;
  detections: SAMDetection[];
  imageWidth: number;
  imageHeight: number;
}

export interface MuseSparkMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type: 'input_text' | 'input_image' | 'output_text';
    text?: string;
    image_url?: string;
  }>;
}

export interface MuseSparkResponse {
  content: string;
  reasoning?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  };
}

/**
 * Parse SAM 3.1 output token string into structured detections
 *
 * Format: <0f>objId<|box;x1=X;y1=Y;x2=X2;y2=Y2;w=W;h=H|><|mask;x=X;y=Y;data=W,H,ENCODED|>,...
 * Empty string means no matches found
 */
export function parseSAMOutput(tokenString: string): {
  detections: SAMDetection[];
  imageWidth: number;
  imageHeight: number;
} {
  if (!tokenString || tokenString.trim() === '') {
    return { detections: [], imageWidth: 0, imageHeight: 0 };
  }

  // Extract frame marker and detections
  const frameMatch = tokenString.match(/<(\d+)f>/);
  if (!frameMatch) {
    throw new Error('Invalid SAM output: missing frame marker');
  }

  // Parse all object detections
  const detections: SAMDetection[] = [];
  let imageWidth = 0;
  let imageHeight = 0;

  // Regex to match: objId<|box;...|><|mask;...|>
  const detectionPattern =
    /(\d+)<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|><\|mask;x=(\d+);y=(\d+);data=([^|]+)\|>/g;

  let match;
  while ((match = detectionPattern.exec(tokenString)) !== null) {
    const [
      ,
      objIdStr,
      x1Str,
      y1Str,
      x2Str,
      y2Str,
      wStr,
      hStr,
      maskXStr,
      maskYStr,
      maskDataStr,
    ] = match;

    if (
      !objIdStr ||
      !x1Str ||
      !y1Str ||
      !x2Str ||
      !y2Str ||
      !wStr ||
      !hStr ||
      !maskXStr ||
      !maskYStr ||
      !maskDataStr
    ) {
      continue;
    }

    imageWidth = parseInt(wStr, 10);
    imageHeight = parseInt(hStr, 10);

    // Parse mask data: "W,H,ENCODED_DATA"
    const maskParts = maskDataStr.split(',');
    const maskWidth = parseInt(maskParts[0] ?? '0', 10);
    const maskHeight = parseInt(maskParts[1] ?? '0', 10);
    const encodedData = maskParts.slice(2).join(',');

    detections.push({
      objectId: parseInt(objIdStr, 10),
      box: {
        objectId: parseInt(objIdStr, 10),
        x1: parseInt(x1Str, 10),
        y1: parseInt(y1Str, 10),
        x2: parseInt(x2Str, 10),
        y2: parseInt(y2Str, 10),
        width: imageWidth,
        height: imageHeight,
      },
      mask: {
        x: parseInt(maskXStr, 10),
        y: parseInt(maskYStr, 10),
        width: maskWidth,
        height: maskHeight,
        data: encodedData,
      },
    });
  }

  return { detections, imageWidth, imageHeight };
}

/**
 * Meta Model API client for SiteSentinel
 */
export class MetaModelAPIProvider {
  private config: MetaModelAPIConfig;

  constructor(config: MetaModelAPIConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? 'https://api.meta.ai/v1',
    };
  }

  /**
   * Segment objects in an image using SAM 3.1
   *
   * @param imageUrl - Data URL (base64) of the image
   * @param concept - Short noun phrase (e.g., "hard hat", "person", "guardrail")
   * @returns Segmentation result with bounding boxes and masks
   */
  async segmentImage(
    imageUrl: string,
    concept: string
  ): Promise<SAMSegmentationResult> {
    const response = await fetch(`${this.config.baseURL}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sam-3.1',
        metadata: { mask_encoding: 'one_bit' },
        input: [
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: concept },
              { type: 'input_image', image_url: imageUrl },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as {
        error?: { message?: string };
      };
      throw new Error(
        `SAM API error: ${error.error?.message ?? response.statusText}`
      );
    }

    const data = (await response.json()) as {
      output: Array<{
        type: string;
        content: Array<{ type: string; text: string }>;
      }>;
    };

    // Find the message output
    const messageOutput = data.output.find((item) => item.type === 'message');
    if (!messageOutput) {
      throw new Error('No message output in SAM response');
    }

    const textContent = messageOutput.content.find(
      (c) => c.type === 'output_text'
    );
    if (!textContent) {
      throw new Error('No text content in SAM message');
    }

    const parsed = parseSAMOutput(textContent.text);

    return {
      concept,
      ...parsed,
    };
  }

  /**
   * Generate completion using Muse Spark 1.3
   *
   * @param messages - Chat messages with optional images
   * @param options - Generation options
   * @returns Model response with content and optional reasoning
   */
  async generateCompletion(
    messages: MuseSparkMessage[],
    options: {
      reasoningEffort?: 'low' | 'medium' | 'high';
      temperature?: number;
    } = {}
  ): Promise<MuseSparkResponse> {
    const requestBody: {
      model: string;
      input: MuseSparkMessage[];
      reasoning?: { effort: string };
      temperature?: number;
    } = {
      model: 'muse-spark-1.3',
      input: messages.map((msg) => ({
        type: 'message' as const,
        role: msg.role,
        content: msg.content,
      })),
    };

    if (options.reasoningEffort) {
      requestBody.reasoning = { effort: options.reasoningEffort };
    }

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    const response = await fetch(`${this.config.baseURL}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = (await response.json()) as {
        error?: { message?: string };
      };
      throw new Error(
        `Muse Spark API error: ${error.error?.message ?? response.statusText}`
      );
    }

    const data = (await response.json()) as {
      output: Array<{
        type: string;
        content?: Array<{ type: string; text: string }>;
      }>;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        output_tokens_details?: { reasoning_tokens: number };
        total_tokens: number;
      };
    };

    // Find reasoning and message outputs
    const reasoningOutput = data.output.find((item) => item.type === 'reasoning');
    const messageOutput = data.output.find((item) => item.type === 'message');

    if (!messageOutput?.content) {
      throw new Error('No message output in Muse Spark response');
    }

    const textContent = messageOutput.content.find(
      (c) => c.type === 'output_text'
    );
    if (!textContent) {
      throw new Error('No text content in Muse Spark message');
    }

    const result: MuseSparkResponse = {
      content: textContent.text,
    };

    if (reasoningOutput) {
      result.reasoning = 'Reasoning available (summary not included in response)';
    }

    if (data.usage) {
      result.usage = {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        reasoningTokens: data.usage.output_tokens_details?.reasoning_tokens ?? 0,
        totalTokens: data.usage.total_tokens,
      };
    }

    return result;
  }
}
