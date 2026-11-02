/**
 * Enhanced Safety Rule Pack with Risk Engineering
 */

import type { RiskCategory, ControlType } from '../models/risk-model.js';

export interface SafetyRule {
  id: string;
  title: string;
  description: string;
  reference: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  requiredEvidence: string[];
  category: RiskCategory;
  typicalLikelihood: 1 | 2 | 3 | 4 | 5;
  typicalImpact: 1 | 2 | 3 | 4 | 5;
  recommendedControl: {
    type: ControlType;
    description: string;
    timeframe: string;
  };
}

export interface SafetyRulePack {
  id: string;
  name: string;
  version: string;
  description: string;
  industry: string;
  rules: SafetyRule[];
  conceptsToDetect: string[];
}

export function loadRulePack(packId: string): SafetyRulePack {
  const packs: Record<string, SafetyRulePack> = {
    construction: constructionPack,
    'oil-and-gas': oilAndGasPack,
  };

  const pack = packs[packId];
  if (!pack) {
    throw new Error(
      `Unknown rule pack: ${packId}. Available: ${Object.keys(packs).join(', ')}`
    );
  }

  return pack;
}

/**
 * Construction Safety Pack (OSHA 1926) - Risk Engineering Edition
 */
const constructionPack: SafetyRulePack = {
  id: 'construction',
  name: 'Construction Safety & Risk Engineering (OSHA 1926)',
  version: '2.0.0',
  description:
    'Comprehensive risk assessment for construction sites including PPE, fire, structural, and process hazards',
  industry: 'Construction',
  conceptsToDetect: [
    'person',
    'hard hat',
    'safety helmet',
    'hi-vis vest',
    'safety vest',
    'harness',
    'safety harness',
    'guardrail',
    'scaffolding',
    'ladder',
    'exit sign',
    'fire extinguisher',
    'caution tape',
    'barrier',
    'leak',
    'spill',
    'corrosion',
    'rust',
    'damaged structure',
    'crack',
    'exposed wire',
    'electrical panel',
    'storage',
    'chemical container',
  ],
  rules: [
    {
      id: 'osha-1926.501-fall-protection',
      title: 'Fall Protection - Unprotected Edges',
      description:
        'Workers at heights of 6 feet or more must have fall protection (guardrails, safety nets, or personal fall arrest systems)',
      reference: '29 CFR 1926.501(b)(1)',
      severity: 'high',
      requiredEvidence: ['person', 'guardrail', 'harness'],
      category: 'Safety/PPE',
      typicalLikelihood: 4,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Engineering',
        description: 'Install permanent guardrail systems',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1926.100-head-protection',
      title: 'Head Protection Required',
      description:
        'Hard hats must be worn in areas where there is a potential for head injury from falling objects',
      reference: '29 CFR 1926.100(a)',
      severity: 'high',
      requiredEvidence: ['person', 'hard hat'],
      category: 'Safety/PPE',
      typicalLikelihood: 3,
      typicalImpact: 4,
      recommendedControl: {
        type: 'PPE',
        description: 'Provide and enforce hard hat usage',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1926.502-fall-arrest',
      title: 'Personal Fall Arrest System',
      description:
        'Workers must use personal fall arrest systems with 100% tie-off when working at heights',
      reference: '29 CFR 1926.502(d)',
      severity: 'high',
      requiredEvidence: ['person', 'harness'],
      category: 'Safety/PPE',
      typicalLikelihood: 4,
      typicalImpact: 5,
      recommendedControl: {
        type: 'PPE',
        description: 'Provide fall arrest harnesses and training',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1926.451-scaffold-safety',
      title: 'Scaffold Structural Integrity',
      description:
        'Scaffolds must be structurally sound with guardrails and proper planking',
      reference: '29 CFR 1926.451(g)(4)',
      severity: 'high',
      requiredEvidence: ['scaffolding', 'guardrail', 'damaged structure'],
      category: 'Structural',
      typicalLikelihood: 3,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Engineering',
        description:
          'Inspect and repair scaffold structure, install guardrails',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1926.34-egress',
      title: 'Means of Egress',
      description:
        'Exit routes must be clearly marked, unobstructed, and adequate for evacuation',
      reference: '29 CFR 1926.34',
      severity: 'high',
      requiredEvidence: ['exit sign', 'barrier'],
      category: 'Fire',
      typicalLikelihood: 2,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Administrative',
        description: 'Remove obstructions, maintain clear egress paths',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1926.150-fire-extinguisher',
      title: 'Fire Extinguisher Access',
      description:
        'Fire extinguishers must be accessible and not blocked by materials or equipment',
      reference: '29 CFR 1926.150(c)',
      severity: 'medium',
      requiredEvidence: ['fire extinguisher', 'barrier'],
      category: 'Fire',
      typicalLikelihood: 2,
      typicalImpact: 4,
      recommendedControl: {
        type: 'Administrative',
        description: 'Clear area around fire equipment, post signage',
        timeframe: '24 hours',
      },
    },
    {
      id: 'nfpa-10-fire-extinguisher-inspection',
      title: 'Fire Extinguisher Maintenance',
      description:
        'Fire extinguishers must be inspected monthly and maintained annually',
      reference: 'NFPA 10',
      severity: 'medium',
      requiredEvidence: ['fire extinguisher'],
      category: 'Fire',
      typicalLikelihood: 2,
      typicalImpact: 4,
      recommendedControl: {
        type: 'Administrative',
        description: 'Establish inspection schedule and documentation',
        timeframe: '1 week',
      },
    },
    {
      id: 'osha-1926.416-electrical-exposed',
      title: 'Exposed Electrical Wiring',
      description:
        'Electrical wiring must be protected from damage and properly insulated',
      reference: '29 CFR 1926.416',
      severity: 'high',
      requiredEvidence: ['exposed wire', 'electrical panel'],
      category: 'Electrical',
      typicalLikelihood: 3,
      typicalImpact: 4,
      recommendedControl: {
        type: 'Engineering',
        description: 'Repair insulation, install conduit protection',
        timeframe: 'immediate',
      },
    },
    {
      id: 'structural-damage-assessment',
      title: 'Structural Damage or Degradation',
      description:
        'Visible cracks, corrosion, or damage to structural members pose collapse risk',
      reference: 'OSHA 1926.800',
      severity: 'critical',
      requiredEvidence: ['damaged structure', 'crack', 'corrosion', 'rust'],
      category: 'Structural',
      typicalLikelihood: 3,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Eliminate',
        description:
          'Evacuate area, conduct structural engineering assessment',
        timeframe: 'immediate',
      },
    },
    {
      id: 'process-leak-spill',
      title: 'Leak or Spill Hazard',
      description:
        'Leaks, spills, or fluid accumulation create slip and contamination hazards',
      reference: 'OSHA 1926.252',
      severity: 'high',
      requiredEvidence: ['leak', 'spill'],
      category: 'Process/Leak',
      typicalLikelihood: 4,
      typicalImpact: 3,
      recommendedControl: {
        type: 'Engineering',
        description: 'Contain spill, repair leak source, install drip pans',
        timeframe: 'immediate',
      },
    },
    {
      id: 'material-storage-unsafe',
      title: 'Unsafe Material Storage',
      description:
        'Materials stored improperly create tip-over and falling object hazards',
      reference: 'OSHA 1926.250',
      severity: 'medium',
      requiredEvidence: ['storage', 'chemical container'],
      category: 'Mechanical/Equipment',
      typicalLikelihood: 3,
      typicalImpact: 3,
      recommendedControl: {
        type: 'Administrative',
        description: 'Establish stacking limits, use proper racking',
        timeframe: '24 hours',
      },
    },
  ],
};

/**
 * Oil & Gas Safety Pack - Risk Engineering Edition
 */
const oilAndGasPack: SafetyRulePack = {
  id: 'oil-and-gas',
  name: 'Oil & Gas Risk Engineering',
  version: '2.0.0',
  description:
    'Comprehensive process safety and risk assessment for oil and gas operations',
  industry: 'Oil and Gas',
  conceptsToDetect: [
    'person',
    'hard hat',
    'safety helmet',
    'hi-vis vest',
    'safety vest',
    'gas detector',
    'h2s monitor',
    'spill',
    'leak',
    'valve',
    'pipe',
    'pressure gauge',
    'warning sign',
    'fire extinguisher',
    'eyewash station',
    'safety shower',
    'respirator',
    'face shield',
    'corrosion',
    'rust',
    'damaged pipe',
    'exposed wire',
  ],
  rules: [
    {
      id: 'osha-1910.132-ppe-requirement',
      title: 'Personal Protective Equipment',
      description:
        'Workers must wear appropriate PPE including hard hats, safety glasses, and protective clothing',
      reference: '29 CFR 1910.132',
      severity: 'high',
      requiredEvidence: ['person', 'hard hat', 'hi-vis vest'],
      category: 'Safety/PPE',
      typicalLikelihood: 3,
      typicalImpact: 4,
      recommendedControl: {
        type: 'PPE',
        description: 'Provide and enforce PPE requirements',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1910.146-h2s-monitoring',
      title: 'H2S and Gas Monitoring',
      description:
        'Gas detectors and H2S monitors must be used in potentially hazardous atmospheres',
      reference: '29 CFR 1910.146',
      severity: 'critical',
      requiredEvidence: ['person', 'gas detector'],
      category: 'Process/Leak',
      typicalLikelihood: 3,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Engineering',
        description: 'Install continuous gas monitoring systems',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1910.119-spill-leak',
      title: 'Process Leak or Spill',
      description:
        'Leaks and spills of hazardous materials must be immediately contained and reported',
      reference: '29 CFR 1910.119',
      severity: 'critical',
      requiredEvidence: ['spill', 'leak'],
      category: 'Process/Leak',
      typicalLikelihood: 4,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Engineering',
        description:
          'Isolate leak, contain spill, implement leak detection system',
        timeframe: 'immediate',
      },
    },
    {
      id: 'api-rp-580-corrosion-management',
      title: 'Corrosion and Pipe Integrity',
      description:
        'Visible corrosion on pipes and equipment indicates potential integrity failure',
      reference: 'API RP 580',
      severity: 'high',
      requiredEvidence: ['corrosion', 'rust', 'damaged pipe', 'pipe'],
      category: 'Structural',
      typicalLikelihood: 4,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Engineering',
        description:
          'Conduct ultrasonic thickness testing, replace corroded sections',
        timeframe: '24 hours',
      },
    },
    {
      id: 'osha-1910.134-respiratory',
      title: 'Respiratory Protection',
      description:
        'Respirators required in areas with airborne contaminants or oxygen deficiency',
      reference: '29 CFR 1910.134',
      severity: 'high',
      requiredEvidence: ['person', 'respirator'],
      category: 'Safety/PPE',
      typicalLikelihood: 3,
      typicalImpact: 4,
      recommendedControl: {
        type: 'PPE',
        description: 'Provide fit-tested respirators and training',
        timeframe: 'immediate',
      },
    },
    {
      id: 'osha-1910.151-emergency-equipment',
      title: 'Emergency Eyewash and Shower Access',
      description:
        'Eyewash stations and safety showers must be accessible where corrosive materials are handled',
      reference: '29 CFR 1910.151(c)',
      severity: 'high',
      requiredEvidence: ['eyewash station', 'safety shower', 'barrier'],
      category: 'Safety/PPE',
      typicalLikelihood: 2,
      typicalImpact: 4,
      recommendedControl: {
        type: 'Administrative',
        description: 'Clear access paths, test equipment weekly',
        timeframe: '24 hours',
      },
    },
    {
      id: 'electrical-hazard-zone',
      title: 'Electrical Hazard in Classified Area',
      description:
        'Exposed electrical in hazardous atmosphere zones creates ignition risk',
      reference: 'API RP 500',
      severity: 'critical',
      requiredEvidence: ['exposed wire', 'warning sign'],
      category: 'Electrical',
      typicalLikelihood: 3,
      typicalImpact: 5,
      recommendedControl: {
        type: 'Engineering',
        description:
          'Install explosion-proof enclosures, de-energize if necessary',
        timeframe: 'immediate',
      },
    },
    {
      id: 'environmental-containment',
      title: 'Environmental Spill Containment',
      description:
        'Secondary containment required for bulk chemical and fuel storage',
      reference: '40 CFR 112',
      severity: 'high',
      requiredEvidence: ['spill', 'chemical container', 'storage'],
      category: 'Environmental',
      typicalLikelihood: 3,
      typicalImpact: 4,
      recommendedControl: {
        type: 'Engineering',
        description: 'Install berm or secondary containment system',
        timeframe: '1 week',
      },
    },
  ],
};

export const rulePacks = {
  construction: constructionPack,
  'oil-and-gas': oilAndGasPack,
};
