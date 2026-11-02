/**
 * Issue Management System for SiteSentinel
 *
 * Tracks hazards through their lifecycle with audit trails
 */

import type { BoundingBox } from '../models/meta-model-api.js';
import type { RiskAssessment, RiskCategory, ControlType } from '../models/risk-model.js';

export type IssueStatus =
  | 'open'
  | 'assigned'
  | 'in-progress'
  | 'pending-verification'
  | 'resolved'
  | 'reopened'
  | 'closed';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  ruleId: string;
  ruleReference: string;

  // Risk assessment
  riskAssessment: RiskAssessment;

  // Location
  siteId: string;
  zone: string;
  imageUrl: string;
  evidenceBoxes: BoundingBox[];

  // Assignment
  assignedTo?: string;
  assignedRole?: string;
  assignedAt?: string;

  // Status
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;

  // Control measures
  recommendedControl: {
    type: ControlType;
    description: string;
    timeframe: string;
  };

  // Verification
  verificationImages?: string[];
  verificationNotes?: string;

  // Voice alert
  voiceAlert?: string;

  // Audit trail
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
}

export interface SiteRoster {
  siteId: string;
  personnel: PersonnelEntry[];
}

export interface PersonnelEntry {
  id: string;
  name: string;
  role: string;
  zones: string[];
  contact?: string;
}

/**
 * Issue store interface
 */
export interface IssueStore {
  create(issue: Issue): Promise<void>;
  get(id: string): Promise<Issue | null>;
  list(filters?: {
    siteId?: string;
    status?: IssueStatus;
    zone?: string;
  }): Promise<Issue[]>;
  update(id: string, updates: Partial<Issue>): Promise<void>;
  addAuditEntry(id: string, entry: AuditEntry): Promise<void>;
}

/**
 * In-memory issue store for local CLI
 */
export class InMemoryIssueStore implements IssueStore {
  private issues: Map<string, Issue> = new Map();

  create(issue: Issue): Promise<void> {
    this.issues.set(issue.id, { ...issue });
    return Promise.resolve();
  }

  get(id: string): Promise<Issue | null> {
    return Promise.resolve(this.issues.get(id) ?? null);
  }

  list(filters?: {
    siteId?: string;
    status?: IssueStatus;
    zone?: string;
  }): Promise<Issue[]> {
    let results = Array.from(this.issues.values());

    if (filters?.siteId) {
      results = results.filter((i) => i.siteId === filters.siteId);
    }

    if (filters?.status) {
      results = results.filter((i) => i.status === filters.status);
    }

    if (filters?.zone) {
      results = results.filter((i) => i.zone === filters.zone);
    }

    return Promise.resolve(
      results.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }

  update(id: string, updates: Partial<Issue>): Promise<void> {
    const issue = this.issues.get(id);
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }

    this.issues.set(id, {
      ...issue,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return Promise.resolve();
  }

  addAuditEntry(id: string, entry: AuditEntry): Promise<void> {
    const issue = this.issues.get(id);
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }

    issue.auditTrail.push(entry);
    issue.updatedAt = new Date().toISOString();
    this.issues.set(id, issue);
    return Promise.resolve();
  }

  // Helper for testing
  clear(): void {
    this.issues.clear();
  }
}

/**
 * File-based issue store for persistence
 */
export class FileIssueStore implements IssueStore {
  private filePath: string;
  private issues: Map<string, Issue> = new Map();

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    try {
      import('fs').then((fs) => {
        if (fs.existsSync(this.filePath)) {
          const data = fs.readFileSync(this.filePath, 'utf-8');
          const parsed = JSON.parse(data) as Issue[];
          this.issues = new Map(parsed.map((issue) => [issue.id, issue]));
        }
      }).catch((error: unknown) => {
        console.warn('Failed to load issues from file:', error);
      });
    } catch (error) {
      console.warn('Failed to load issues from file:', error);
    }
  }

  private async save(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.dirname(this.filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = JSON.stringify(Array.from(this.issues.values()), null, 2);
      fs.writeFileSync(this.filePath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to save issues to file:', error);
    }
  }

  async create(issue: Issue): Promise<void> {
    this.issues.set(issue.id, { ...issue });
    await this.save();
  }

  get(id: string): Promise<Issue | null> {
    return Promise.resolve(this.issues.get(id) ?? null);
  }

  list(filters?: {
    siteId?: string;
    status?: IssueStatus;
    zone?: string;
  }): Promise<Issue[]> {
    let results = Array.from(this.issues.values());

    if (filters?.siteId) {
      results = results.filter((i) => i.siteId === filters.siteId);
    }

    if (filters?.status) {
      results = results.filter((i) => i.status === filters.status);
    }

    if (filters?.zone) {
      results = results.filter((i) => i.zone === filters.zone);
    }

    return Promise.resolve(
      results.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }

  async update(id: string, updates: Partial<Issue>): Promise<void> {
    const issue = this.issues.get(id);
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }

    this.issues.set(id, {
      ...issue,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await this.save();
  }

  async addAuditEntry(id: string, entry: AuditEntry): Promise<void> {
    const issue = this.issues.get(id);
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }

    issue.auditTrail.push(entry);
    issue.updatedAt = new Date().toISOString();
    this.issues.set(id, issue);
    await this.save();
  }
}

/**
 * Load site roster from JSON
 */
export function loadSiteRoster(siteId: string): SiteRoster {
  // Default roster for demo
  return {
    siteId,
    personnel: [
      {
        id: 'safety-1',
        name: 'Safety Supervisor',
        role: 'Safety Manager',
        zones: ['all'],
      },
      {
        id: 'maint-1',
        name: 'Maintenance Lead',
        role: 'Maintenance',
        zones: ['equipment', 'mechanical'],
      },
      {
        id: 'elec-1',
        name: 'Electrical Supervisor',
        role: 'Electrical',
        zones: ['electrical', 'power'],
      },
      {
        id: 'struct-1',
        name: 'Structural Engineer',
        role: 'Engineering',
        zones: ['structural', 'scaffolding'],
      },
      {
        id: 'fire-1',
        name: 'Fire Safety Officer',
        role: 'Fire Safety',
        zones: ['fire', 'egress'],
      },
    ],
  };
}

/**
 * Assign issue to appropriate personnel based on category and zone
 */
export function assignIssue(
  issue: Issue,
  roster: SiteRoster
): { id: string; name: string; role: string } | null {
  // Map categories to roles
  const roleMapping: Record<string, string[]> = {
    'Safety/PPE': ['Safety Manager'],
    Fire: ['Fire Safety', 'Safety Manager'],
    'Mechanical/Equipment': ['Maintenance'],
    Structural: ['Engineering', 'Safety Manager'],
    'Process/Leak': ['Maintenance', 'Safety Manager'],
    Electrical: ['Electrical'],
    Environmental: ['Safety Manager'],
    'Human Factors': ['Safety Manager'],
  };

  const preferredRoles = roleMapping[issue.category] ?? ['Safety Manager'];

  // Find personnel matching role and zone
  for (const role of preferredRoles) {
    const person = roster.personnel.find(
      (p) =>
        p.role === role &&
        (p.zones.includes('all') || p.zones.includes(issue.zone.toLowerCase()))
    );

    if (person) {
      return person;
    }
  }

  // Fallback to safety manager
  return roster.personnel.find((p) => p.role === 'Safety Manager') ?? null;
}
