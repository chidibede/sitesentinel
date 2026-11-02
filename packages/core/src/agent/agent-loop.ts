/**
 * Agent Loop Orchestrator for SiteSentinel
 *
 * Multi-step agentic workflow:
 * Detect → Assess Risk → Create Issue → Assign → Notify → Verify → Close/Reopen
 */

import { randomUUID } from 'crypto';
import type { HazardDetectionPipeline, HazardFinding } from '../pipeline/hazard-detection-v2.js';
import type { IssueStore, Issue, AuditEntry, SiteRoster } from './issue-manager.js';
import { assignIssue } from './issue-manager.js';
import { assessRisk } from '../models/risk-model.js';
import { generateVoiceAlert } from './voice-services.js';

export interface AgentLoopConfig {
  pipeline: HazardDetectionPipeline;
  issueStore: IssueStore;
  roster: SiteRoster;
  siteId: string;
}

export interface DetectionResult {
  issues: Issue[];
  auditTrail: AuditEntry[];
}

export interface VerificationResult {
  issueId: string;
  resolved: boolean;
  reason: string;
  auditTrail: AuditEntry[];
}

/**
 * Main Agent Loop
 */
export class AgentLoop {
  constructor(private config: AgentLoopConfig) {}

  /**
   * Step 1-5: Full detection and issue creation loop
   */
  async detectAndCreateIssues(
    imageBuffer: Buffer,
    zone: string,
    imagePath: string
  ): Promise<DetectionResult> {
    const auditTrail: AuditEntry[] = [];
    const issues: Issue[] = [];

    // Step 1: Detect hazards
    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'detect_start',
      actor: 'system',
      details: { zone, imagePath },
    });

    const findings = await this.config.pipeline.detect(imageBuffer);

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'detect_complete',
      actor: 'system',
      details: {
        findingsCount: findings.length,
        findings: findings.map((f) => ({ rule: f.rule.id, severity: f.rule.severity })),
      },
    });

    // Steps 2-5 for each finding
    for (const finding of findings) {
      const issue = await this.createIssueFromFinding(
        finding,
        zone,
        imagePath,
        auditTrail
      );
      issues.push(issue);
    }

    return { issues, auditTrail };
  }

  /**
   * Create issue from finding (Steps 2-5)
   */
  private async createIssueFromFinding(
    finding: HazardFinding,
    zone: string,
    imagePath: string,
    auditTrail: AuditEntry[]
  ): Promise<Issue> {
    // Step 2: Assess risk
    const riskAssessment = assessRisk(
      finding.rule.typicalLikelihood,
      finding.rule.typicalImpact
    );

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'assess_risk',
      actor: 'system',
      details: {
        rule: finding.rule.id,
        likelihood: riskAssessment.likelihood,
        impact: riskAssessment.impact,
        riskScore: riskAssessment.riskScore,
        riskBand: riskAssessment.riskBand,
      },
    });

    // Step 3: Create issue
    const issueId = randomUUID();
    const now = new Date().toISOString();

    const issue: Issue = {
      id: issueId,
      title: finding.rule.title,
      description: `${finding.rule.description}\n\nEvidence: ${finding.evidence}`,
      category: finding.rule.category,
      ruleId: finding.rule.id,
      ruleReference: finding.rule.reference,
      riskAssessment,
      siteId: this.config.siteId,
      zone,
      imageUrl: imagePath,
      evidenceBoxes: finding.evidenceBoxes,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      recommendedControl: finding.rule.recommendedControl,
      auditTrail: [],
    };

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'create_issue',
      actor: 'system',
      details: {
        issueId,
        rule: finding.rule.id,
        category: issue.category,
        riskBand: issue.riskAssessment.riskBand,
      },
    });

    // Step 4: Assign owner
    const assigned = assignIssue(issue, this.config.roster);
    if (assigned) {
      issue.assignedTo = assigned.name;
      issue.assignedRole = assigned.role;
      issue.assignedAt = new Date().toISOString();
      issue.status = 'assigned';

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'assign_issue',
        actor: 'system',
        details: {
          issueId,
          assignedTo: assigned.name,
          role: assigned.role,
        },
      });
    }

    // Step 5: Generate voice alert and notify
    const voiceAlert = generateVoiceAlert(issue);
    issue.voiceAlert = voiceAlert;

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'notify',
      actor: 'system',
      details: {
        issueId,
        voiceAlert,
        notificationSent: true,
      },
    });

    // Copy audit trail to issue
    issue.auditTrail = [...auditTrail];

    // Persist issue
    await this.config.issueStore.create(issue);

    return issue;
  }

  /**
   * Step 6: Verify fix
   */
  async verifyFix(
    issueId: string,
    afterImageBuffer: Buffer,
    afterImagePath: string
  ): Promise<VerificationResult> {
    const auditTrail: AuditEntry[] = [];

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'verify_start',
      actor: 'system',
      details: { issueId, afterImagePath },
    });

    // Get original issue
    const issue = await this.config.issueStore.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    // Re-run detection on after image
    const afterFindings = await this.config.pipeline.detect(afterImageBuffer);

    // Check if the specific hazard still exists
    const stillPresent = afterFindings.some(
      (f) => f.rule.id === issue.ruleId
    );

    const resolved = !stillPresent;
    let reason = '';

    if (resolved) {
      reason = `The ${issue.category} hazard "${issue.title}" is no longer detected in the verification image. The recommended control measures appear to have been implemented successfully.`;
    } else {
      const matchedFinding = afterFindings.find(
        (f) => f.rule.id === issue.ruleId
      );
      reason = `The ${issue.category} hazard "${issue.title}" is still present. Evidence: ${matchedFinding?.evidence ?? 'Detected'}. Further corrective action is required.`;
    }

    auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'verify_complete',
      actor: 'system',
      details: {
        issueId,
        resolved,
        stillPresent,
        afterFindingsCount: afterFindings.length,
      },
    });

    // Update issue status
    const updates: Partial<Issue> = {
      verificationImages: [...(issue.verificationImages ?? []), afterImagePath],
      verificationNotes: reason,
      status: resolved ? 'resolved' : 'reopened',
      updatedAt: new Date().toISOString(),
    };

    if (resolved) {
      updates.resolvedAt = new Date().toISOString();

      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'close_issue',
        actor: 'system',
        details: { issueId, reason },
      });
    } else {
      auditTrail.push({
        timestamp: new Date().toISOString(),
        action: 'reopen_issue',
        actor: 'system',
        details: { issueId, reason },
      });
    }

    await this.config.issueStore.update(issueId, updates);

    // Add audit entries
    for (const entry of auditTrail) {
      await this.config.issueStore.addAuditEntry(issueId, entry);
    }

    return { issueId, resolved, reason, auditTrail };
  }

  /**
   * Full loop: before image → create issues → after image → verify all
   */
  async runFullLoop(
    beforeImageBuffer: Buffer,
    beforeImagePath: string,
    afterImageBuffer: Buffer,
    afterImagePath: string,
    zone: string
  ): Promise<{
    detectionResult: DetectionResult;
    verificationResults: VerificationResult[];
    summary: string;
  }> {
    // Detection phase
    const detectionResult = await this.detectAndCreateIssues(
      beforeImageBuffer,
      zone,
      beforeImagePath
    );

    // Verification phase
    const verificationResults: VerificationResult[] = [];

    for (const issue of detectionResult.issues) {
      const verification = await this.verifyFix(
        issue.id,
        afterImageBuffer,
        afterImagePath
      );
      verificationResults.push(verification);
    }

    // Summary
    const totalIssues = detectionResult.issues.length;
    const resolvedCount = verificationResults.filter((v) => v.resolved).length;
    const unresolvedCount = totalIssues - resolvedCount;

    const summary = [
      `Agent Loop Complete`,
      `==================`,
      `Total Issues Detected: ${totalIssues}`,
      `Resolved: ${resolvedCount}`,
      `Unresolved: ${unresolvedCount}`,
      '',
      'Issues:',
      ...detectionResult.issues.map((issue, idx) => {
        const verification = verificationResults[idx];
        const status = verification?.resolved ? '✓ RESOLVED' : '✗ UNRESOLVED';
        return `  ${idx + 1}. [${issue.riskAssessment.riskBand.toUpperCase()}] ${issue.title} - ${status}`;
      }),
    ].join('\n');

    return { detectionResult, verificationResults, summary };
  }
}
