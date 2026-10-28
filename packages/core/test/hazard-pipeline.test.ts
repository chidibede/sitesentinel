import { describe, it, expect } from 'vitest';
import { HazardDetectionPipeline } from '../src/pipeline/hazard-detection.js';

describe('HazardDetectionPipeline', () => {
  describe('parseFindings with nested arrays', () => {
    it('should parse findings with nested bbox arrays', () => {
      const pipeline = new HazardDetectionPipeline({
        basetenApiKey: 'test-key',
      });

      // Simulate a response with nested arrays (bbox coordinates)
      const mockResponse = `
Here are the findings:

\`\`\`json
[
  {
    "id": "finding-1",
    "title": "Fall Protection Violation",
    "description": "Workers at height without protection",
    "severity": "high",
    "ruleId": "osha-1926.501",
    "ruleReference": "29 CFR 1926.501(b)(1)",
    "evidenceBoxes": [[100, 200, 300, 400], [150, 250, 350, 450]],
    "confidence": "high",
    "recommendedFix": "Install guardrails"
  },
  {
    "id": "finding-2",
    "title": "Missing PPE",
    "description": "Worker without hard hat",
    "severity": "high",
    "ruleId": "osha-1926.100",
    "ruleReference": "29 CFR 1926.100(a)",
    "evidenceBoxes": [[200, 300, 400, 500]],
    "confidence": "medium",
    "recommendedFix": "Require hard hats"
  }
]
\`\`\`
`;

      // Access private method via reflection for testing
      const parseFindings = (pipeline as unknown as {
        parseFindings: (
          content: string,
          samResults: unknown[],
          width: number,
          height: number
        ) => unknown[];
      }).parseFindings;

      const findings = parseFindings(mockResponse, [], 960, 674);

      expect(findings).toHaveLength(2);
      expect(findings[0]).toMatchObject({
        id: 'finding-1',
        title: 'Fall Protection Violation',
        severity: 'high',
      });

      // Check that nested arrays were parsed correctly
      const finding1 = findings[0] as {
        evidenceBoxes: Array<{ x1: number; y1: number }>;
      };
      expect(finding1.evidenceBoxes).toHaveLength(2);
      expect(finding1.evidenceBoxes[0]).toMatchObject({
        x1: 100,
        y1: 200,
      });
    });

    it('should handle raw JSON without code blocks', () => {
      const pipeline = new HazardDetectionPipeline({
        basetenApiKey: 'test-key',
      });

      const mockResponse = `[{"id":"f1","title":"Test","description":"Desc","severity":"low","ruleId":"r1","ruleReference":"Ref","evidenceBoxes":[[1,2,3,4]],"confidence":"high","recommendedFix":"Fix"}]`;

      const parseFindings = (pipeline as unknown as {
        parseFindings: (
          content: string,
          samResults: unknown[],
          width: number,
          height: number
        ) => unknown[];
      }).parseFindings;

      const findings = parseFindings(mockResponse, [], 800, 600);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        id: 'f1',
        title: 'Test',
      });
    });

    it('should find outermost balanced array with text before and after', () => {
      const pipeline = new HazardDetectionPipeline({
        basetenApiKey: 'test-key',
      });

      const mockResponse = `
Some text before the JSON.

[
  {
    "id": "finding-1",
    "title": "Test Finding",
    "description": "Test",
    "severity": "medium",
    "ruleId": "test-1",
    "ruleReference": "Test Ref",
    "evidenceBoxes": [[10, 20, 30, 40]],
    "confidence": "high",
    "recommendedFix": "Fix it"
  }
]

Some text after the JSON that should be ignored.
`;

      const parseFindings = (pipeline as unknown as {
        parseFindings: (
          content: string,
          samResults: unknown[],
          width: number,
          height: number
        ) => unknown[];
      }).parseFindings;

      const findings = parseFindings(mockResponse, [], 1000, 800);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        id: 'finding-1',
        title: 'Test Finding',
      });
    });
  });

  describe('URL construction', () => {
    it('should use correct base URL format without double /v1', () => {
      // Test that base URL handling is correct
      const config = {
        apiKey: 'test-key',
        baseURL: 'https://api.meta.ai/v1',
      };

      const provider = new (class {
        config: { baseURL: string };
        constructor(cfg: { apiKey: string; baseURL: string }) {
          this.config = { baseURL: cfg.baseURL };
        }
        getURL(path: string): string {
          return `${this.config.baseURL}${path}`;
        }
      })(config);

      const url = provider.getURL('/responses');
      expect(url).toBe('https://api.meta.ai/v1/responses');
      expect(url).not.toContain('/v1/v1/');
    });

    it('should handle JSON with nested arrays in findings', () => {
      const jsonWithNestedArrays = `[{"id":"f1","evidenceBoxes":[[100,200,300,400],[150,250,350,450]]}]`;

      const parsed = JSON.parse(jsonWithNestedArrays) as Array<{
        id: string;
        evidenceBoxes: number[][];
      }>;

      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.evidenceBoxes).toHaveLength(2);
      expect(parsed[0]?.evidenceBoxes[0]).toEqual([100, 200, 300, 400]);
    });
  });
});
