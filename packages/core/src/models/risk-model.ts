/**
 * Risk Engineering Model for SiteSentinel
 *
 * Comprehensive risk assessment framework following ISO 31000 principles
 */

export type RiskCategory =
  | 'Safety/PPE'
  | 'Fire'
  | 'Mechanical/Equipment'
  | 'Structural'
  | 'Process/Leak'
  | 'Electrical'
  | 'Environmental'
  | 'Human Factors';

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export type ControlType =
  | 'Eliminate'
  | 'Substitute'
  | 'Engineering'
  | 'Administrative'
  | 'PPE';

export interface RiskAssessment {
  likelihood: 1 | 2 | 3 | 4 | 5; // 1=rare, 5=almost certain
  impact: 1 | 2 | 3 | 4 | 5; // 1=negligible, 5=catastrophic
  riskScore: number; // likelihood × impact (1-25)
  riskBand: RiskBand;
}

export interface HierarchyOfControls {
  type: ControlType;
  description: string;
  timeframe: string; // "immediate", "24 hours", "1 week", etc.
}

/**
 * Calculate risk band from score
 */
export function calculateRiskBand(score: number): RiskBand {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

/**
 * Assess risk level
 */
export function assessRisk(
  likelihood: 1 | 2 | 3 | 4 | 5,
  impact: 1 | 2 | 3 | 4 | 5
): RiskAssessment {
  const riskScore = likelihood * impact;
  return {
    likelihood,
    impact,
    riskScore,
    riskBand: calculateRiskBand(riskScore),
  };
}
