/**
 * Voice Services for SiteSentinel
 *
 * Voice transcription and alert generation
 */

import type { Issue } from '../agent/issue-manager.js';

export interface TranscriptionConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}

/**
 * Muse Voice Transcribe Provider
 */
export class MuseVoiceTranscribe {
  constructor(private config: TranscriptionConfig) {}

  async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', this.config.model);

    const response = await fetch(`${this.config.baseURL}/asr/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Transcription failed: ${response.status} ${response.statusText} ${errorText}`
      );
    }

    const result = (await response.json()) as { text: string };
    return {
      text: result.text,
    };
  }
}

/**
 * Generate voice alert text for an issue
 */
export function generateVoiceAlert(issue: Issue): string {
  const severity = issue.riskAssessment.riskBand.toUpperCase();
  const categoryShort = issue.category.replace('/', ' or ');

  let alert = `${severity} priority alert. ${categoryShort} hazard detected in ${issue.zone}. `;

  alert += `${issue.title}. `;

  if (issue.assignedTo) {
    alert += `Assigned to ${issue.assignedTo}. `;
  }

  const timeframe = issue.recommendedControl.timeframe;
  if (timeframe === 'immediate') {
    alert += 'Action required immediately.';
  } else {
    alert += `Action required within ${timeframe}.`;
  }

  return alert;
}

/**
 * TTS Hook Interface
 *
 * Placeholder for future TTS integration
 */
export interface TTSProvider {
  synthesize(text: string): Promise<Buffer>;
}

export class TTSHook implements TTSProvider {
  synthesize(text: string): Promise<Buffer> {
    console.log('[TTS Hook] Would synthesize:', text);
    return Promise.resolve(Buffer.alloc(0));
  }
}
