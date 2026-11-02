/**
 * Hazard Detection Pipeline - Agent Loop Edition
 *
 * Updated to work with risk engineering model
 */

import type {
  MetaModelAPIProvider,
  SAMSegmentationResult,
  BoundingBox,
  MuseSparkMessage,
} from '../models/meta-model-api.js';
import type { BasetenProvider } from '../models/baseten.js';
import type { Message } from '../models/types.js';
import type { SafetyRule, SafetyRulePack } from '../safety-rules/rule-packs-v2.js';
import sharp from 'sharp';

export interface HazardFinding {
  rule: SafetyRule;
  evidence: string;
  evidenceBoxes: BoundingBox[];
}

export interface AgentPipelineConfig {
  samProvider?: MetaModelAPIProvider;
  sparkProvider: MetaModelAPIProvider | BasetenProvider;
  rulePack: SafetyRulePack;
}

/**
 * Hazard detection pipeline for agent loop
 */
export class HazardDetectionPipeline {
  constructor(private config: AgentPipelineConfig) {}

  /**
   * Detect hazards in image
   */
  async detect(imageBuffer: Buffer): Promise<HazardFinding[]> {
    const rulePack = this.config.rulePack;

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width ?? 0;
    const imageHeight = metadata.height ?? 0;

    // Convert to data URL
    const base64 = imageBuffer.toString('base64');
    const imageDataUrl = `data:image/jpeg;base64,${base64}`;

    // Run SAM if available
    let samResults: SAMSegmentationResult[] = [];

    if (this.config.samProvider) {
      samResults = await this.detectConcepts(
        imageDataUrl,
        rulePack.conceptsToDetect
      );
    }

    // Analyze with Spark
    const findings = await this.analyzeFindingsWithSpark(
      imageDataUrl,
      samResults,
      rulePack,
      imageWidth,
      imageHeight
    );

    return findings;
  }

  /**
   * Detect concepts with SAM
   */
  private async detectConcepts(
    imageDataUrl: string,
    concepts: string[]
  ): Promise<SAMSegmentationResult[]> {
    const samProvider = this.config.samProvider;
    if (!samProvider) {
      return [];
    }

    const results = await Promise.all(
      concepts.map((concept) =>
        samProvider.segmentImage(imageDataUrl, concept)
      )
    );

    return results;
  }

  /**
   * Analyze findings with Muse Spark
   */
  private async analyzeFindingsWithSpark(
    imageDataUrl: string,
    samResults: SAMSegmentationResult[],
    rulePack: SafetyRulePack,
    imageWidth: number,
    imageHeight: number
  ): Promise<HazardFinding[]> {
    const prompt = this.buildSparkPrompt(rulePack, samResults);

    let completion: string;

    // Check if provider is MetaModelAPIProvider (has generateCompletion with Meta format)
    if ('segmentImage' in this.config.sparkProvider) {
      // Meta Model API - use input_text and input_image types
      const metaMessages: MuseSparkMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageDataUrl },
          ],
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const response = await (this.config.sparkProvider as MetaModelAPIProvider).generateCompletion(
        metaMessages,
        {
          temperature: 0.3,
          reasoningEffort: 'low',
        }
      );
      completion = response.content;
    } else {
      // Baseten - use text and image_url types
      const basetenMessages: Message[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const response = await (this.config.sparkProvider as BasetenProvider).generateCompletion(
        basetenMessages,
        { temperature: 0.3 }
      );
      completion = response.content ?? '';
    }

    return this.parseFindings(completion, rulePack, samResults, imageWidth, imageHeight);
  }

  /**
   * Build Spark prompt
   */
  private buildSparkPrompt(rulePack: SafetyRulePack, samResults: SAMSegmentationResult[]): string {
    const evidenceText = samResults
      .filter((r) => r.detections.length > 0)
      .map((r) => {
        const boxes = r.detections
          .map((d) => `[${d.box.x1},${d.box.y1},${d.box.x2},${d.box.y2}]`)
          .join(', ');
        return `- ${r.concept}: ${r.detections.length} detected (boxes: ${boxes})`;
      })
      .join('\n');

    const rulesText = rulePack.rules
      .map(
        (rule) =>
          `- ${rule.id}: ${rule.title} (${rule.category})\n  Reference: ${rule.reference}\n  Look for: ${rule.requiredEvidence.join(', ')}`
      )
      .join('\n\n');

    return `You are a safety inspector analyzing a worksite image. Review the image and detected objects to identify hazards.

Industry: ${rulePack.industry}
Rule Pack: ${rulePack.name}

Detected Objects:
${evidenceText || 'No objects detected.'}

Safety Rules:
${rulesText}

For each violation found, output a JSON object:
{
  "ruleId": "rule-id",
  "evidence": "description of what you see",
  "evidenceBoxes": [[x1, y1, x2, y2], ...] // bounding boxes if available
}

Output format: A JSON array of findings inside a code block.
If no violations are found, output an empty array: []`;
  }

  /**
   * Parse findings from Spark response
   */
  private parseFindings(
    completion: string,
    rulePack: SafetyRulePack,
    samResults: SAMSegmentationResult[],
    _imageWidth: number,
    _imageHeight: number
  ): HazardFinding[] {
    const findings: HazardFinding[] = [];

    const jsonMatch =
      completion.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      completion.match(/(\[[\s\S]*\])/);

    if (!jsonMatch || !jsonMatch[1]) {
      return findings;
    }

    let parsed: unknown[];
    try {
      const parsedData: unknown = JSON.parse(jsonMatch[1]);
      if (!Array.isArray(parsedData)) {
        return findings;
      }
      parsed = parsedData;
    } catch {
      return findings;
    }

    if (!Array.isArray(parsed)) {
      return findings;
    }

    for (const item of parsed) {
      if (typeof item !== 'object' || !item || !('ruleId' in item)) continue;

      const typedItem = item as { ruleId?: string; evidenceBoxes?: unknown; evidence?: string };
      const ruleId = typedItem.ruleId;
      if (!ruleId) continue;

      const rule = rulePack.rules.find((r) => r.id === ruleId);
      if (!rule) continue;

      let evidenceBoxes: BoundingBox[] = [];

      const evidenceBoxesProp = typedItem.evidenceBoxes;
      if (Array.isArray(evidenceBoxesProp)) {
        evidenceBoxes = evidenceBoxesProp.map((box: unknown) => {
          if (!Array.isArray(box)) {
            return { x1: 0, y1: 0, x2: 0, y2: 0 };
          }
          const x1Val = typeof box[0] === 'number' ? box[0] : 0;
          const y1Val = typeof box[1] === 'number' ? box[1] : 0;
          const x2Val = typeof box[2] === 'number' ? box[2] : 0;
          const y2Val = typeof box[3] === 'number' ? box[3] : 0;
          return {
            x1: x1Val,
            y1: y1Val,
            x2: x2Val,
            y2: y2Val,
          };
        });
      } else {
        const matchedConcepts = rule.requiredEvidence;
        for (const concept of matchedConcepts) {
          const samResult = samResults.find((r) => r.concept === concept);
          if (samResult && samResult.detections.length > 0) {
            evidenceBoxes.push(...samResult.detections.map((d) => d.box));
          }
        }
      }

      const evidence = typedItem.evidence;
      findings.push({
        rule,
        evidence: evidence ?? rule.description,
        evidenceBoxes,
      });
    }

    return findings;
  }
}
