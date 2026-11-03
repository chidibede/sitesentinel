/**
 * Risk Model Tests
 */

import { describe, it, expect } from 'vitest';
import { assessRisk, calculateRiskBand } from '../src/models/risk-model.js';

describe('Risk Model', () => {
  describe('calculateRiskBand', () => {
    it('should return critical for score >= 20', () => {
      expect(calculateRiskBand(25)).toBe('critical');
      expect(calculateRiskBand(20)).toBe('critical');
    });

    it('should return high for score 12-19', () => {
      expect(calculateRiskBand(19)).toBe('high');
      expect(calculateRiskBand(12)).toBe('high');
    });

    it('should return medium for score 6-11', () => {
      expect(calculateRiskBand(11)).toBe('medium');
      expect(calculateRiskBand(6)).toBe('medium');
    });

    it('should return low for score < 6', () => {
      expect(calculateRiskBand(5)).toBe('low');
      expect(calculateRiskBand(1)).toBe('low');
    });
  });

  describe('assessRisk', () => {
    it('should calculate risk score as likelihood × impact', () => {
      const assessment = assessRisk(4, 5);
      expect(assessment.likelihood).toBe(4);
      expect(assessment.impact).toBe(5);
      expect(assessment.riskScore).toBe(20);
      expect(assessment.riskBand).toBe('critical');
    });

    it('should handle low risk scenarios', () => {
      const assessment = assessRisk(2, 2);
      expect(assessment.riskScore).toBe(4);
      expect(assessment.riskBand).toBe('low');
    });
  });
});
