export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Import core types for consistency
export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export type RiskCategory = 
  | 'Safety/PPE'
  | 'Fire'
  | 'Mechanical/Equipment'
  | 'Structural'
  | 'Process/Leak'
  | 'Electrical'
  | 'Environmental'
  | 'Human Factors';

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
  category: RiskCategory;
  riskBand: RiskBand;
  riskScore: number;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  zone: string;
  status: IssueStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  imageUrl: string;
  evidenceBoxes: BoundingBox[];
  auditTrail: AuditEntry[];
  verificationImages?: string[];
  voiceAlert?: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
}

export interface InspectRequest {
  image: string;
  rulePackId?: string;
  zone?: string;
  siteId?: string;
  provider?: 'meta' | 'baseten';
  returnOverlay?: boolean;
}

export interface InspectResponse {
  issues: Issue[];
  auditTrail: AuditEntry[];
  overlayUrl?: string;
}

export interface VerifyRequest {
  afterImage: string;
  provider?: 'meta' | 'baseten';
}

export interface VerifyResponse {
  issueId: string;
  resolved: boolean;
  reason: string;
  afterImageUrl: string;
  overlayUrl?: string;
  auditTrail: AuditEntry[];
}

export interface VoiceReportRequest {
  audio: string;
  siteId?: string;
  zone?: string;
}

export interface VoiceReportResponse {
  transcription: string;
  siteId: string;
  zone: string;
  message: string;
}
