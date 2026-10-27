/**
 * Meta Model API provider for Muse Spark, SAM 3.1, and Muse Voice Transcribe
 *
 * API Reference:
 * - Base URL: https://api.meta.ai/v1
 * - Auth: Bearer token via META_API_KEY
 * - Models: muse-spark-1.3, sam-3.1, muse-voice-transcribe-1.0
 *
 * Endpoints:
 * - POST /v1/responses (OpenAI-compatible)
 * - POST /v1/chat/completions (OpenAI-compatible)
 * - POST /v1/asr/transcribe (audio file transcription)
 * - WSS /v1/asr/realtime (streaming audio transcription)
 */

export interface MetaModelAPIConfig {
  apiKey: string;
  baseURL?: string;
}

export interface SAMSegmentationResult {
  objectId: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  mask: string; // Token-encoded mask data
}

export interface AudioTranscriptionOptions {
  model?: string;
  audioEncoding?: 'PCM_16KHZ' | 'PCM_24KHZ';
  mode?: 'PUSH_TO_TALK' | 'ENDPOINTING' | 'DIARIZATION';
}

export interface TranscriptionResult {
  text: string;
  speakers?: Array<{
    speaker: string;
    text: string;
    startMs?: number;
    endMs?: number;
  }>;
}

/**
 * Meta Model API provider - implementation placeholder
 *
 * TODO: Implement once Meta Model API access is available
 * This is a typed interface stub based on the official documentation:
 * - https://dev.meta.ai/docs/api-reference
 * - https://dev.meta.ai/docs/sam/overview
 * - https://dev.meta.ai/docs/speech-to-text/
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
   * Get the base URL for API requests
   * Used internally by all API methods
   */
  private getBaseURL(): string {
    return this.config.baseURL ?? 'https://api.meta.ai/v1';
  }

  /**
   * Get authorization headers for API requests
   * Used internally by all API methods
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Segment objects in an image using SAM 3.1
   *
   * @param imageUrl - URL or base64 data URL of the image
   * @param prompt - Short noun phrase describing the object to segment (e.g., "hard hat", "safety vest")
   * @returns Array of segmentation results with bounding boxes and masks
   *
   * Reference: https://dev.meta.ai/docs/sam/overview
   */
  async segmentImage(
    _imageUrl: string,
    _prompt: string
  ): Promise<SAMSegmentationResult[]> {
    // TODO: Implement SAM 3.1 segmentation
    // POST to /v1/responses with model: "sam-3.1"
    // Will use: this.getBaseURL(), this.getAuthHeaders()
    // Request shape:
    // {
    //   model: "sam-3.1",
    //   input: [
    //     { type: "message", role: "user", content: [
    //       { type: "input_text", text: prompt },
    //       { type: "input_image", image_url: imageUrl }
    //     ]}
    //   ],
    //   stream: true
    // }
    // Parse output_text deltas for box/mask tokens per frame
    // Will use: this.getBaseURL(), this.getAuthHeaders()
    throw new Error('SAM 3.1 segmentation not yet implemented');
  }

  /**
   * Transcribe audio using Muse Voice Transcribe
   *
   * @param audioData - Audio file buffer (mono 16-bit PCM WAV, 16kHz or 24kHz)
   * @param options - Transcription options
   * @returns Transcription result with text and optional speaker diarization
   *
   * Reference: https://dev.meta.ai/docs/speech-to-text/
   */
  async transcribeAudio(
    _audioData: Buffer,
    _options: AudioTranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    // TODO: Implement audio transcription
    // POST multipart to /v1/asr/transcribe
    // Form fields: "request" (JSON config) and "audio" (WAV file)
    // Request config:
    // {
    //   model: "muse-voice-transcribe-1.0",
    //   audioEncoding: "PCM_16KHZ" | "PCM_24KHZ",
    //   mode: "ENDPOINTING" | "DIARIZATION"
    // }
    // Will use: this.getBaseURL(), this.getAuthHeaders()
    throw new Error('Audio transcription not yet implemented');
  }

  /**
   * Generate completion using Muse Spark
   *
   * @param messages - Chat messages
   * @param options - Generation options
   * @returns Model response
   *
   * Reference: https://dev.meta.ai/docs/models
   */
  async generateCompletion(
    _messages: unknown[],
    _options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<{ content: string | null; reasoning?: string }> {
    // TODO: Implement Muse Spark completion
    // POST to /v1/responses or /v1/chat/completions
    // Model: "muse-spark-1.3"
    // OpenAI-compatible format
    // Will use: this.getBaseURL(), this.getAuthHeaders()
    throw new Error('Muse Spark completion not yet implemented');
  }
}
