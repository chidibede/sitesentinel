/**
 * Rule Packs V2 Tests
 */

import { describe, it, expect } from 'vitest';
import { loadRulePack } from '../src/safety-rules/rule-packs-v2.js';

describe('Rule Packs V2', () => {
  it('should load construction rule pack', () => {
    const pack = loadRulePack('construction');

    expect(pack.id).toBe('construction');
    expect(pack.name).toContain('Construction Safety');
    expect(pack.version).toBe('2.0.0');
    expect(pack.rules.length).toBeGreaterThan(5);

    const headProtectionRule = pack.rules.find((r) => r.id === 'osha-1926.100-head-protection');
    expect(headProtectionRule).toBeDefined();
    expect(headProtectionRule?.category).toBe('Safety/PPE');
    expect(headProtectionRule?.typicalLikelihood).toBeGreaterThan(0);
    expect(headProtectionRule?.typicalImpact).toBeGreaterThan(0);
    expect(headProtectionRule?.recommendedControl.type).toBe('PPE');
  });

  it('should load oil-and-gas rule pack', () => {
    const pack = loadRulePack('oil-and-gas');

    expect(pack.id).toBe('oil-and-gas');
    expect(pack.name).toContain('Oil & Gas');
    expect(pack.version).toBe('2.0.0');
    expect(pack.rules.length).toBeGreaterThan(5);

    const h2sRule = pack.rules.find((r) => r.id === 'osha-1910.146-h2s-monitoring');
    expect(h2sRule).toBeDefined();
    expect(h2sRule?.category).toBe('Process/Leak');
    expect(h2sRule?.recommendedControl.type).toBe('Engineering');
  });

  it('should have risk engineering fields in all rules', () => {
    const pack = loadRulePack('construction');

    for (const rule of pack.rules) {
      expect(rule.category).toBeDefined();
      expect(rule.typicalLikelihood).toBeGreaterThanOrEqual(1);
      expect(rule.typicalLikelihood).toBeLessThanOrEqual(5);
      expect(rule.typicalImpact).toBeGreaterThanOrEqual(1);
      expect(rule.typicalImpact).toBeLessThanOrEqual(5);
      expect(rule.recommendedControl).toBeDefined();
      expect(rule.recommendedControl.type).toBeDefined();
      expect(rule.recommendedControl.description).toBeDefined();
      expect(rule.recommendedControl.timeframe).toBeDefined();
    }
  });

  it('should include extended risk engineering checks', () => {
    const construction = loadRulePack('construction');

    const leakRule = construction.rules.find((r) => r.id === 'process-leak-spill');
    expect(leakRule).toBeDefined();
    expect(leakRule?.category).toBe('Process/Leak');

    const structuralRule = construction.rules.find(
      (r) => r.id === 'structural-damage-assessment'
    );
    expect(structuralRule).toBeDefined();
    expect(structuralRule?.category).toBe('Structural');

    const electricalRule = construction.rules.find((r) => r.id === 'osha-1926.416-electrical-exposed');
    expect(electricalRule).toBeDefined();
    expect(electricalRule?.category).toBe('Electrical');
  });

  it('should throw error for unknown rule pack', () => {
    expect(() => loadRulePack('invalid-pack')).toThrow();
  });
});
