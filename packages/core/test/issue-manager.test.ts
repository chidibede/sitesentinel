/**
 * Issue Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryIssueStore, assignIssue, loadSiteRoster } from '../src/agent/issue-manager.js';
import type { Issue } from '../src/agent/issue-manager.js';

describe('InMemoryIssueStore', () => {
  let store: InMemoryIssueStore;

  beforeEach(() => {
    store = new InMemoryIssueStore();
  });

  it('should create and retrieve an issue', async () => {
    const issue: Issue = {
      id: 'test-1',
      title: 'Test Hazard',
      description: 'Test description',
      category: 'Safety/PPE',
      ruleId: 'test-rule',
      ruleReference: 'TEST 123',
      riskAssessment: {
        likelihood: 3,
        impact: 4,
        riskScore: 12,
        riskBand: 'high',
      },
      siteId: 'site-1',
      zone: 'zone-a',
      imageUrl: 'test.jpg',
      evidenceBoxes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendedControl: {
        type: 'PPE',
        description: 'Wear hard hat',
        timeframe: 'immediate',
      },
      auditTrail: [],
    };

    await store.create(issue);

    const retrieved = await store.get('test-1');
    expect(retrieved).toEqual(issue);
  });

  it('should list issues with filters', async () => {
    const issue1: Issue = {
      id: 'test-1',
      title: 'Issue 1',
      description: 'Desc 1',
      category: 'Fire',
      ruleId: 'rule-1',
      ruleReference: 'REF 1',
      riskAssessment: {
        likelihood: 2,
        impact: 3,
        riskScore: 6,
        riskBand: 'medium',
      },
      siteId: 'site-1',
      zone: 'zone-a',
      imageUrl: 'test1.jpg',
      evidenceBoxes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendedControl: {
        type: 'Administrative',
        description: 'Clear path',
        timeframe: '24 hours',
      },
      auditTrail: [],
    };

    const issue2: Issue = {
      ...issue1,
      id: 'test-2',
      status: 'resolved',
      siteId: 'site-2',
    };

    await store.create(issue1);
    await store.create(issue2);

    const openIssues = await store.list({ status: 'open' });
    expect(openIssues).toHaveLength(1);
    expect(openIssues[0]?.id).toBe('test-1');

    const site1Issues = await store.list({ siteId: 'site-1' });
    expect(site1Issues).toHaveLength(1);
  });

  it('should update an issue', async () => {
    const issue: Issue = {
      id: 'test-1',
      title: 'Original',
      description: 'Desc',
      category: 'Electrical',
      ruleId: 'rule',
      ruleReference: 'REF',
      riskAssessment: {
        likelihood: 3,
        impact: 3,
        riskScore: 9,
        riskBand: 'medium',
      },
      siteId: 'site',
      zone: 'zone',
      imageUrl: 'img.jpg',
      evidenceBoxes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendedControl: {
        type: 'Engineering',
        description: 'Fix',
        timeframe: 'immediate',
      },
      auditTrail: [],
    };

    await store.create(issue);
    await store.update('test-1', { status: 'resolved' });

    const updated = await store.get('test-1');
    expect(updated?.status).toBe('resolved');
  });

  it('should add audit entries', async () => {
    const issue: Issue = {
      id: 'test-1',
      title: 'Test',
      description: 'Desc',
      category: 'Structural',
      ruleId: 'rule',
      ruleReference: 'REF',
      riskAssessment: {
        likelihood: 4,
        impact: 5,
        riskScore: 20,
        riskBand: 'critical',
      },
      siteId: 'site',
      zone: 'zone',
      imageUrl: 'img.jpg',
      evidenceBoxes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendedControl: {
        type: 'Eliminate',
        description: 'Evacuate',
        timeframe: 'immediate',
      },
      auditTrail: [],
    };

    await store.create(issue);
    await store.addAuditEntry('test-1', {
      timestamp: new Date().toISOString(),
      action: 'test_action',
      actor: 'system',
      details: { foo: 'bar' },
    });

    const updated = await store.get('test-1');
    expect(updated?.auditTrail).toHaveLength(1);
    expect(updated?.auditTrail[0]?.action).toBe('test_action');
  });
});

describe('assignIssue', () => {
  it('should assign issue based on category and zone', () => {
    const roster = loadSiteRoster('test-site');

    const issue: Issue = {
      id: 'test',
      title: 'Electrical Hazard',
      description: 'Desc',
      category: 'Electrical',
      ruleId: 'elec-1',
      ruleReference: 'REF',
      riskAssessment: {
        likelihood: 3,
        impact: 4,
        riskScore: 12,
        riskBand: 'high',
      },
      siteId: 'site',
      zone: 'electrical',
      imageUrl: 'img.jpg',
      evidenceBoxes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendedControl: {
        type: 'Engineering',
        description: 'Fix wiring',
        timeframe: 'immediate',
      },
      auditTrail: [],
    };

    const assigned = assignIssue(issue, roster);

    expect(assigned).toBeDefined();
    expect(assigned?.role).toBe('Electrical');
  });

  it('should fallback to safety manager for unknown categories', () => {
    const roster = loadSiteRoster('test-site');

    const issue: Issue = {
      id: 'test',
      title: 'Unknown',
      description: 'Desc',
      category: 'Human Factors',
      ruleId: 'human-1',
      ruleReference: 'REF',
      riskAssessment: {
        likelihood: 2,
        impact: 2,
        riskScore: 4,
        riskBand: 'low',
      },
      siteId: 'site',
      zone: 'general',
      imageUrl: 'img.jpg',
      evidenceBoxes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendedControl: {
        type: 'Administrative',
        description: 'Training',
        timeframe: '1 week',
      },
      auditTrail: [],
    };

    const assigned = assignIssue(issue, roster);

    expect(assigned).toBeDefined();
    expect(assigned?.role).toBe('Safety Manager');
  });
});
