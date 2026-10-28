/**
 * Hazard Detection Pipeline
 *
 * Orchestrates the full inspection flow:
 * 1. Image in → Muse Spark proposes concepts to detect
 * 2. SAM 3.1 runs each concept in parallel
 * 3. Evidence merged and analyzed
 * 4. Muse Spark checks findings against safety manual
 * 5. Structured JSON findings output
 */

import {
  MetaModelAPIProvider,
  type SAMSegmentationResult,
  type BoundingBox,
} from '../models/meta-model-api.js';
import { BasetenProvider } from '../models/baseten.js';
import { loadRulePack, type SafetyRulePack } from '../safety-rules/rule-packs.js';

export interface HazardFinding {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ruleId: string;
  ruleReference: string;
  evidenceBoxes: BoundingBox[];
  confidence: 'low' | 'medium' | 'high' | 'cannot-confirm';
  recommendedFix: string;
}

export interface InspectionResult {
  findings: HazardFinding[];
  rulePack: {
    id: string;
    name: string;
  };
  evidence: {
    concept: string;
    detections: number;
  }[];
  metadata: {
    timestamp: string;
    provider: 'meta-model-api' | 'baseten';
    imageSize: {
      width: number;
      height: number;
    };
  };
}

export interface PipelineOptions {
  rulePackId: string;
  provider?: 'meta' | 'baseten';
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Main hazard detection pipeline
 */
export class HazardDetectionPipeline {
  private metaProvider?: MetaModelAPIProvider;
  private basetenProvider?: BasetenProvider;

  constructor(config: {
    metaApiKey?: string;
    basetenApiKey?: string;
  }) {
    if (config.metaApiKey) {
      this.metaProvider = new MetaModelAPIProvider({
        apiKey: config.metaApiKey,
      });
    }

    if (config.basetenApiKey) {
      this.basetenProvider = new BasetenProvider({
        apiKey: config.basetenApiKey,
      });
    }
  }

  /**
   * Run full inspection pipeline
   */
  async inspect(
    imageDataUrl: string,
    options: PipelineOptions
  ): Promise<InspectionResult> {
    const provider = options.provider ?? 'meta';

    // Load safety rules
    const rulePack = loadRulePack(options.rulePackId);

    // Step 1: Propose concepts (or use predefined from rule pack)
    const conceptsToDetect = rulePack.conceptsToDetect;

    // Step 2: Get image dimensions
    let imageWidth = 0;
    let imageHeight = 0;

    // Extract image buffer from data URL to get dimensions
    try {
      const base64Data = imageDataUrl.split(',')[1];
      if (base64Data) {
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const sharp = (await import('sharp')).default;
        const metadata = await sharp(imageBuffer).metadata();
        imageWidth = metadata.width ?? 0;
        imageHeight = metadata.height ?? 0;
      }
    } catch (error) {
      console.warn('Failed to get image dimensions:', error);
    }

    // Step 3: Run SAM for each concept in parallel (only with Meta provider)
    let samResults: SAMSegmentationResult[] = [];

    if (provider === 'meta' && this.metaProvider) {
      samResults = await this.detectConcepts(imageDataUrl, conceptsToDetect);

      // Update dimensions from SAM if available
      if (samResults.length > 0 && samResults[0]) {
        imageWidth = samResults[0].imageWidth || imageWidth;
        imageHeight = samResults[0].imageHeight || imageHeight;
      }
    }

    // Step 4: Analyze findings with Muse Spark
    const findings = await this.analyzeFindingsWithSpark(
      imageDataUrl,
      samResults,
      rulePack,
      provider,
      options.reasoningEffort ?? 'low',
      imageWidth,
      imageHeight
    );

    return {
      findings,
      rulePack: {
        id: rulePack.id,
        name: rulePack.name,
      },
      evidence: samResults.map((result) => ({
        concept: result.concept,
        detections: result.detections.length,
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        provider: provider === 'meta' ? 'meta-model-api' : 'baseten',
        imageSize: {
          width: imageWidth,
          height: imageHeight,
        },
      },
    };
  }

  /**
   * Detect all concepts using SAM 3.1
   */
  private async detectConcepts(
    imageDataUrl: string,
    concepts: string[]
  ): Promise<SAMSegmentationResult[]> {
    if (!this.metaProvider) {
      throw new Error('Meta Model API provider not configured');
    }

    const provider = this.metaProvider;

    // Run SAM for each concept in parallel
    const results = await Promise.all(
      concepts.map((concept) =>
        provider.segmentImage(imageDataUrl, concept).catch((error: unknown) => {
          console.warn(`SAM detection failed for "${concept}":`, error);
          return {
            concept,
            detections: [],
            imageWidth: 0,
            imageHeight: 0,
          };
        })
      )
    );

    // Filter out concepts with no detections
    return results.filter((r) => r.detections.length > 0);
  }

  /**
   * Analyze findings with Muse Spark or Baseten
   */
  private async analyzeFindingsWithSpark(
    imageDataUrl: string,
    samResults: SAMSegmentationResult[],
    rulePack: SafetyRulePack,
    provider: 'meta' | 'baseten',
    reasoningEffort: 'low' | 'medium' | 'high',
    imageWidth: number,
    imageHeight: number
  ): Promise<HazardFinding[]> {
    if (!this.metaProvider && !this.basetenProvider) {
      throw new Error('No provider configured');
    }
    // Build evidence summary
    const evidenceSummary = samResults
      .map(
        (r) =>
          `- ${r.concept}: ${r.detections.length} detected (boxes: ${r.detections
            .map((d) => `[${d.box.x1},${d.box.y1},${d.box.x2},${d.box.y2}]`)
            .join(', ')})`
      )
      .join('\n');

    // Build rules context
    const rulesContext = rulePack.rules
      .map(
        (rule) =>
          `${rule.id}: ${rule.title} - ${rule.description} (Ref: ${rule.reference}, Severity: ${rule.severity})`
      )
      .join('\n\n');

    const prompt = `You are a safety inspector analyzing a worksite image for compliance with ${rulePack.name}.

DETECTED EVIDENCE:
${evidenceSummary || 'No objects detected by segmentation system.'}

SAFETY RULES TO CHECK:
${rulesContext}

Analyze the image and detected evidence against the safety rules. Return a JSON array of findings with this exact structure:
[
  {
    "id": "finding-1",
    "title": "Brief title",
    "description": "Detailed description of the violation or hazard",
    "severity": "low|medium|high|critical",
    "ruleId": "exact rule id from above",
    "ruleReference": "exact reference from rule",
    "evidenceBoxes": [[x1,y1,x2,y2], ...],
    "confidence": "low|medium|high|cannot-confirm",
    "recommendedFix": "Specific corrective action"
  }
]

Rules:
- Only cite rules from the provided list above
- Use evidenceBoxes from detected objects when applicable
- Mark findings as "cannot-confirm" if evidence is insufficient
- Include at least 1 finding or explain why the site is safe
- Return ONLY valid JSON, no markdown or extra text`;

    if (provider === 'baseten' && this.basetenProvider) {
      const response = await this.basetenProvider.generateCompletion([
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: imageDataUrl },
          ],
        },
      ]);

      return this.parseFindings(response.content ?? '', samResults, imageWidth, imageHeight);
    } else if (provider === 'meta' && this.metaProvider) {
      const response = await this.metaProvider.generateCompletion(
        [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: imageDataUrl },
            ],
          },
        ],
        { reasoningEffort }
      );

      return this.parseFindings(response.content, samResults, imageWidth, imageHeight);
    }

    throw new Error('No provider configured');
  }

  /**
   * Parse findings from LLM response
   */
  private parseFindings(
    content: string,
    _samResults: SAMSegmentationResult[],
    imageWidth: number,
    imageHeight: number
  ): HazardFinding[] {
    // Extract JSON from markdown code blocks first
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
    
    let jsonText: string | undefined;
    
    if (codeBlockMatch?.[1]) {
      jsonText = codeBlockMatch[1];
    } else {
      // Find outermost balanced array
      const startIdx = content.indexOf('[');
      if (startIdx === -1) {
        console.warn('No JSON array found in response, returning empty findings');
        return [];
      }
      
      let depth = 0;
      let endIdx = -1;
      
      for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '[') depth++;
        if (content[i] === ']') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      
      if (endIdx === -1) {
        console.warn('No complete JSON array found in response, returning empty findings');
        return [];
      }
      
      jsonText = content.substring(startIdx, endIdx + 1);
    }

    if (!jsonText) {
      console.warn('No JSON text extracted, returning empty findings');
      return [];
    }

    const parsed = JSON.parse(jsonText) as unknown;

    if (!Array.isArray(parsed)) {
      console.warn('Response is not an array, returning empty findings');
      return [];
    }

    // Validate and enrich findings
    const findings: HazardFinding[] = [];

    for (const item of parsed) {
      const f = item as Record<string, unknown>;

      if (
        typeof f.id === 'string' &&
        typeof f.title === 'string' &&
        typeof f.description === 'string' &&
        typeof f.severity === 'string' &&
        typeof f.ruleId === 'string' &&
        typeof f.ruleReference === 'string' &&
        typeof f.confidence === 'string' &&
        typeof f.recommendedFix === 'string'
      ) {
        // Parse evidence boxes
        const boxes: BoundingBox[] = [];

        if (Array.isArray(f.evidenceBoxes)) {
          for (const box of f.evidenceBoxes) {
            if (Array.isArray(box) && box.length === 4) {
              boxes.push({
                objectId: boxes.length,
                x1: Number(box[0]),
                y1: Number(box[1]),
                x2: Number(box[2]),
                y2: Number(box[3]),
                width: imageWidth,
                height: imageHeight,
              });
            }
          }
        }

        findings.push({
          id: f.id,
          title: f.title,
          description: f.description,
          severity: f.severity as 'low' | 'medium' | 'high' | 'critical',
          ruleId: f.ruleId,
          ruleReference: f.ruleReference,
          evidenceBoxes: boxes,
          confidence: f.confidence as 'low' | 'medium' | 'high' | 'cannot-confirm',
          recommendedFix: f.recommendedFix,
        });
      }
    }

    return findings;
  }
}
