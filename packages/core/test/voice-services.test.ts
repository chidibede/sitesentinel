/**
 * Voice Services Tests
 */

import { describe, it, expect } from 'vitest';
import { generateVoiceAlert } from '../src/agent/voice-services.js';
import type { Issue } from '../src/agent/issue-manager.js';

describe('Voice Services', () => {
  describe('generateVoiceAlert', () => {
    it('should generate alert for critical issue with immediate action', () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Fall Hazard Detected',
        description: 'Workers without fall protection',
        category: 'Safety/PPE',
        ruleId: 'fall-1',
        ruleReference: 'OSHA 1926.501',
        riskAssessment: {
          likelihood: 4,
          impact: 5,
          riskScore: 20,
          riskBand: 'critical',
        },
        siteId: 'site-1',
        zone: 'roof-access',
        imageUrl: 'img.jpg',
        evidenceBoxes: [],
        status: 'assigned',
        assignedTo: 'Safety Supervisor',
        assignedRole: 'Safety Manager',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recommendedControl: {
          type: 'Engineering',
          description: 'Install guardrails',
          timeframe: 'immediate',
        },
        auditTrail: [],
      };

      const alert = generateVoiceAlert(issue);

      expect(alert).toContain('CRITICAL priority alert');
      expect(alert).toContain('Safety or PPE hazard');
      expect(alert).toContain('roof-access');
      expect(alert).toContain('Fall Hazard Detected');
      expect(alert).toContain('Safety Supervisor');
      expect(alert).toContain('immediately');
    });

    it('should generate alert for medium risk with timeframe', () => {
      const issue: Issue = {
        id: 'test-2',
        title: 'Fire Extinguisher Blocked',
        description: 'Materials blocking access',
        category: 'Fire',
        ruleId: 'fire-1',
        ruleReference: 'NFPA 10',
        riskAssessment: {
          likelihood: 2,
          impact: 4,
          riskScore: 8,
          riskBand: 'medium',
        },
        siteId: 'site-1',
        zone: 'warehouse',
        imageUrl: 'img.jpg',
        evidenceBoxes: [],
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recommendedControl: {
          type: 'Administrative',
          description: 'Clear area',
          timeframe: '24 hours',
        },
        auditTrail: [],
      };

      const alert = generateVoiceAlert(issue);

      expect(alert).toContain('MEDIUM priority alert');
      expect(alert).toContain('Fire hazard');
      expect(alert).toContain('warehouse');
      expect(alert).toContain('within 24 hours');
    });

    it('should handle unassigned issues', () => {
      const issue: Issue = {
        id: 'test-3',
        title: 'Leak Detected',
        description: 'Fluid leak',
        category: 'Process/Leak',
        ruleId: 'leak-1',
        ruleReference: 'OSHA 1926',
        riskAssessment: {
          likelihood: 3,
          impact: 3,
          riskScore: 9,
          riskBand: 'medium',
        },
        siteId: 'site-1',
        zone: 'equipment-bay',
        imageUrl: 'img.jpg',
        evidenceBoxes: [],
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recommendedControl: {
          type: 'Engineering',
          description: 'Repair leak',
          timeframe: 'immediate',
        },
        auditTrail: [],
      };

      const alert = generateVoiceAlert(issue);

      expect(alert).not.toContain('Assigned to');
      expect(alert).toContain('Process or Leak hazard');
    });
  });
});
