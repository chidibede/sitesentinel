import { describe, it, expect } from 'vitest';
import {
  parseSAMOutput,
  type SAMDetection,
} from '../src/models/meta-model-api.js';
import samPersonFixture from './fixtures/api-responses/sam_person.json';
import samHardHatFixture from './fixtures/api-responses/sam_hard_hat.json';

describe('parseSAMOutput', () => {
  it('should parse empty string as no detections', () => {
    const result = parseSAMOutput('');
    expect(result.detections).toHaveLength(0);
    expect(result.imageWidth).toBe(0);
    expect(result.imageHeight).toBe(0);
  });

  it('should parse real SAM person detection response', () => {
    const output = samPersonFixture.output.find((o) => o.type === 'message');
    const text = output?.content[0]?.text;
    if (!text) {
      throw new Error('No text content in fixture');
    }

    const result = parseSAMOutput(text);

    expect(result.imageWidth).toBe(960);
    expect(result.imageHeight).toBe(674);
    expect(result.detections).toHaveLength(6);

    // Check first detection
    const first = result.detections[0];
    if (!first) {
      throw new Error('No first detection');
    }
    expect(first.objectId).toBe(0);
    expect(first.box.x1).toBe(707);
    expect(first.box.y1).toBe(127);
    expect(first.box.x2).toBe(802);
    expect(first.box.y2).toBe(309);

    // Check mask data structure
    expect(first.mask.width).toBe(183);
    expect(first.mask.height).toBe(96);
    expect(first.mask.data).toContain('!!!!');
  });

  it('should parse real SAM hard hat detection response', () => {
    const output = samHardHatFixture.output.find((o) => o.type === 'message');
    const text = output?.content[0]?.text;
    if (!text) {
      throw new Error('No text content in fixture');
    }

    const result = parseSAMOutput(text);

    expect(result.imageWidth).toBe(960);
    expect(result.imageHeight).toBe(674);
    expect(result.detections).toHaveLength(4);

    // Check specific hard hat detection
    const firstHat = result.detections[0];
    if (!firstHat) {
      throw new Error('No first detection');
    }
    expect(firstHat.objectId).toBe(0);
    expect(firstHat.box.x1).toBe(742);
    expect(firstHat.box.y1).toBe(397);
    expect(firstHat.box.x2).toBe(766);
    expect(firstHat.box.y2).toBe(419);

    // Verify mask dimensions
    expect(firstHat.mask.width).toBe(23);
    expect(firstHat.mask.height).toBe(25);
  });

  it('should handle multiple objects with correct IDs', () => {
    const output = samPersonFixture.output.find((o) => o.type === 'message');
    const text = output?.content[0]?.text;
    if (!text) {
      throw new Error('No text content in fixture');
    }

    const result = parseSAMOutput(text);

    // Verify all object IDs are sequential
    const objectIds = result.detections.map((d) => d.objectId);
    expect(objectIds).toEqual([0, 1, 2, 3, 4, 5]);

    // Verify each detection has correct box dimensions
    result.detections.forEach((detection: SAMDetection) => {
      expect(detection.box.x1).toBeLessThan(detection.box.x2);
      expect(detection.box.y1).toBeLessThan(detection.box.y2);
      expect(detection.box.width).toBe(960);
      expect(detection.box.height).toBe(674);
    });
  });

  it('should extract mask data correctly', () => {
    const output = samHardHatFixture.output.find((o) => o.type === 'message');
    const text = output?.content[0]?.text;
    if (!text) {
      throw new Error('No text content in fixture');
    }

    const result = parseSAMOutput(text);

    result.detections.forEach((detection: SAMDetection) => {
      // Mask should have dimensions
      expect(detection.mask.width).toBeGreaterThan(0);
      expect(detection.mask.height).toBeGreaterThan(0);

      // Mask data should be non-empty
      expect(detection.mask.data.length).toBeGreaterThan(0);

      // Mask data should start with expected encoding markers
      expect(detection.mask.data).toMatch(/^!!!!/);
    });
  });

  it('should throw error for invalid format', () => {
    expect(() => parseSAMOutput('invalid format')).toThrow(
      'Invalid SAM output: missing frame marker'
    );
  });
});
