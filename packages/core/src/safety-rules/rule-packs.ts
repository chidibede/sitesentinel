/**
 * Safety Rule Pack Type Definitions
 */

export interface SafetyRule {
  id: string;
  title: string;
  description: string;
  reference: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  requiredEvidence: string[]; // Concepts to look for (e.g., "person", "hard hat")
  category: string;
}

export interface SafetyRulePack {
  id: string;
  name: string;
  version: string;
  description: string;
  industry: string;
  rules: SafetyRule[];
  conceptsToDetect: string[]; // All concepts SAM should look for
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
 * Construction Safety Pack (OSHA 1926)
 */
const constructionPack: SafetyRulePack = {
  id: 'construction',
  name: 'Construction Safety (OSHA 1926)',
  version: '1.0.0',
  description:
    'OSHA construction standards focusing on fall protection, PPE, and scaffolding',
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
      category: 'Fall Protection',
    },
    {
      id: 'osha-1926.100-head-protection',
      title: 'Head Protection Required',
      description:
        'Hard hats must be worn in areas where there is a potential for head injury from falling objects',
      reference: '29 CFR 1926.100(a)',
      severity: 'high',
      requiredEvidence: ['person', 'hard hat'],
      category: 'Personal Protective Equipment',
    },
    {
      id: 'osha-1926.502-fall-arrest',
      title: 'Personal Fall Arrest System',
      description:
        'Workers must use personal fall arrest systems with 100% tie-off when working at heights',
      reference: '29 CFR 1926.502(d)',
      severity: 'high',
      requiredEvidence: ['person', 'harness'],
      category: 'Fall Protection',
    },
    {
      id: 'osha-1926.451-scaffold-guardrails',
      title: 'Scaffold Guardrail System',
      description:
        'Scaffolds must have guardrails installed on all open sides and ends',
      reference: '29 CFR 1926.451(g)(4)',
      severity: 'high',
      requiredEvidence: ['scaffolding', 'guardrail'],
      category: 'Scaffolding',
    },
    {
      id: 'osha-1926.200-high-visibility',
      title: 'High-Visibility Clothing',
      description:
        'Workers must wear high-visibility vests or clothing in areas with vehicular traffic',
      reference: '29 CFR 1926.200(g)',
      severity: 'medium',
      requiredEvidence: ['person', 'hi-vis vest'],
      category: 'Personal Protective Equipment',
    },
    {
      id: 'osha-1926.34-egress',
      title: 'Means of Egress',
      description:
        'Exit routes must be clearly marked, unobstructed, and adequate for evacuation',
      reference: '29 CFR 1926.34',
      severity: 'high',
      requiredEvidence: ['exit sign', 'barrier'],
      category: 'Emergency Preparedness',
    },
    {
      id: 'osha-1926.150-fire-protection',
      title: 'Fire Extinguisher Access',
      description:
        'Fire extinguishers must be accessible and not blocked by materials or equipment',
      reference: '29 CFR 1926.150(c)',
      severity: 'medium',
      requiredEvidence: ['fire extinguisher', 'barrier'],
      category: 'Fire Safety',
    },
  ],
};

/**
 * Oil & Gas Safety Pack
 */
const oilAndGasPack: SafetyRulePack = {
  id: 'oil-and-gas',
  name: 'Oil & Gas Facility Safety',
  version: '1.0.0',
  description: 'Safety standards for oil and gas operations including OSHA 1910',
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
      category: 'Personal Protective Equipment',
    },
    {
      id: 'osha-1910.146-confined-space',
      title: 'H2S Monitoring Required',
      description:
        'Gas detectors and H2S monitors must be used in potentially hazardous atmospheres',
      reference: '29 CFR 1910.146',
      severity: 'critical',
      requiredEvidence: ['person', 'gas detector'],
      category: 'Atmospheric Hazards',
    },
    {
      id: 'osha-1910.119-spill-response',
      title: 'Spill and Leak Control',
      description:
        'Spills and leaks of hazardous materials must be immediately contained and reported',
      reference: '29 CFR 1910.119',
      severity: 'critical',
      requiredEvidence: ['spill', 'leak'],
      category: 'Process Safety',
    },
    {
      id: 'osha-1910.134-respiratory',
      title: 'Respiratory Protection',
      description:
        'Respirators required in areas with airborne contaminants or oxygen deficiency',
      reference: '29 CFR 1910.134',
      severity: 'high',
      requiredEvidence: ['person', 'respirator'],
      category: 'Personal Protective Equipment',
    },
    {
      id: 'osha-1910.151-eyewash',
      title: 'Emergency Eyewash and Shower',
      description:
        'Eyewash stations and safety showers must be accessible where corrosive materials are handled',
      reference: '29 CFR 1910.151(c)',
      severity: 'high',
      requiredEvidence: ['eyewash station', 'safety shower'],
      category: 'Emergency Equipment',
    },
    {
      id: 'api-rp-500-hazard-zones',
      title: 'Hazardous Area Classification',
      description:
        'Work in classified hazardous areas must follow proper procedures and equipment requirements',
      reference: 'API RP 500',
      severity: 'high',
      requiredEvidence: ['warning sign', 'person'],
      category: 'Electrical Safety',
    },
  ],
};

export const rulePacks = {
  construction: constructionPack,
  'oil-and-gas': oilAndGasPack,
};
