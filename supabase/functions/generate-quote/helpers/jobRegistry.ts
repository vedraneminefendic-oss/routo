// ============================================================================
// JOB REGISTRY - DATA-DRIVEN JOBBDEFINITIONER
// ============================================================================

export interface JobDefinition {
  jobType: string;
  category: 'rot' | 'rut' | 'none';
  unitType: 'kvm' | 'lm' | 'st' | 'tim';
  requiredInput?: string[]; 

  timePerUnit: {
    simple: number;
    normal: number;
    complex: number;
  };
  
  multipliers: {
    accessibility: { easy: number; normal: number; hard: number };
    quality: { budget: number; standard: number; premium: number };
    complexity: { simple: number; normal: number; complex: number };
  };
  
  hourlyRateRange: { min: number; typical: number; max: number };
  materialRatio: number;
  
  materialBuckets: {
    budget: { priceMultiplier: number; examples: string[] };
    standard: { priceMultiplier: number; examples: string[] };
    premium: { priceMultiplier: number; examples: string[] };
  };
  
  priceBounds: {
    minPerUnit: number;
    maxPerUnit: number;
    totalMin: number;
    totalMax: number;
  };
  
  standardWorkItems: Array<{
    name: string;
    mandatory: boolean;
    typicalHours: number;
    perUnit?: boolean;
  }>;
  
  materialCalculations?: Array<{
    name: string;
    unit: string;
    formula: string;
    roundUp?: boolean;
    pricePerUnit: {
      budget: number;
      standard: number;
      premium: number;
    };
  }>;
  
  applicableDeduction: 'rot' | 'rut' | 'none';
  deductionPercentage: number;
  
  serviceVehicle?: {
    threshold: number;
    autoInclude: boolean;
    unit: 'dag' | 'halv';
  };
  
  questionTemplates: {
    unitQty: string;
    complexity: string;
    accessibility: string;
    qualityLevel: string;
  };
  
  regionSensitive?: boolean;
  seasonSensitive?: boolean;
  fallbackBehavior?: {
    defaultUnitQty: number;
    assumptionText: string;
  };
  proportionRules?: {
    maxSingleItemShare: number;
    demolitionMaxShare?: number;
    minWorkItems: number;
  };
  
  customerMaterialPatterns?: string[];
  customerProvidedLabel?: string;
  
  source: string;
  lastUpdated: string;
}

export const JOB_REGISTRY: JobDefinition[] = [
  // ==========================================
  // 1. ROT-TJÄNSTER (30% Avdrag)
  // ==========================================

  // MÅLNING (KORRIGERAD TILL ROT)
  {
    jobType: 'målning',
    category: 'rot', // VIKTIGT: ROT, inte RUT
    unitType: 'kvm',
    requiredInput: ['area', 'complexity'],
    timePerUnit: { simple: 0.3, normal: 0.4, complex: 0.6 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 450, typical: 550, max: 650 },
    materialRatio: 0.25,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Lågpris'] },
      standard: { priceMultiplier: 1.0, examples: ['Nordsjö/Jotun'] },
      premium: { priceMultiplier: 1.4, examples: ['Eko/Premium'] }
    },
    priceBounds: { minPerUnit: 150, maxPerUnit: 400, totalMin: 5000, totalMax: 80000 },
    standardWorkItems: [
      { name: 'Täckning & Maskering', mandatory: true, typicalHours: 0.05, perUnit: true },
      { name: 'Spackling & Slipning', mandatory: true, typicalHours: 0.10, perUnit: true },
      { name: 'Grundmålning', mandatory: false, typicalHours: 0.10, perUnit: true },
      { name: 'Färdigstrykning (2 ggr)', mandatory: true, typicalHours: 0.15, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Väggfärg', unit: 'liter', formula: 'unitQty / 6', pricePerUnit: { budget: 150, standard: 250, premium: 400 } },
      { name: 'Spackel & Slippapper', unit: 'set', formula: '1', pricePerUnit: { budget: 300, standard: 500, premium: 800 } },
      { name: 'Täckpapp & Tejp', unit: 'rullar', formula: 'Math.ceil(unitQty / 20)', roundUp: true, pricePerUnit: { budget: 100, standard: 150, premium: 200 } }
    ],
    applicableDeduction: 'rot', // VIKTIGT
    deductionPercentage: 30,    // VIKTIGT: 30%
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'halv' },
    questionTemplates: {
      unitQty: 'Hur stor väggyta ska målas (ca kvm)?',
      complexity: 'Är det många hörn, fönster eller högt i tak?',
      accessibility: 'Är rummet tömt på möbler?',
      qualityLevel: 'Vilken kvalitet på färgen önskas?'
    },
    source: 'Måleriföretagen',
    lastUpdated: '2024-11-24'
  },

  // BADRUM (ROT)
  {
    jobType: 'badrum',
    category: 'rot',
    unitType: 'kvm',
    requiredInput: ['area', 'complexity'],
    timePerUnit: { simple: 35, normal: 50, complex: 70 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 600, typical: 750, max: 950 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standard'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklass'] },
      premium: { priceMultiplier: 1.6, examples: ['Lyx'] }
    },
    priceBounds: { minPerUnit: 15000, maxPerUnit: 75000, totalMin: 60000, totalMax: 350000 },
    standardWorkItems: [
      { name: 'Rivning', mandatory: true, typicalHours: 4.0, perUnit: false },
      { name: 'VVS-installation', mandatory: true, typicalHours: 12.0, perUnit: false },
      { name: 'Tätskikt & Plattsättning', mandatory: true, typicalHours: 2.5, perUnit: true },
      { name: 'Elinstallation', mandatory: true, typicalHours: 6.0, perUnit: false }
    ],
    materialCalculations: [
      { name: 'Kakel/Klinker', unit: 'kvm', formula: 'unitQty * 1.15', pricePerUnit: { budget: 300, standard: 800, premium: 2000 } },
      { name: 'Tätskiktssystem', unit: 'pkt', formula: '1', pricePerUnit: { budget: 3000, standard: 5000, premium: 8000 } },
      { name: 'Inredning & Blandare', unit: 'pkt', formula: '1', pricePerUnit: { budget: 5000, standard: 15000, premium: 40000 } }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 1, autoInclude: true, unit: 'dag' },
    questionTemplates: { unitQty: 'Golvyta (kvm)?', complexity: 'Totalrenovering?', accessibility: 'Våning?', qualityLevel: 'Lyx?' },
    source: 'Byggfakta',
    lastUpdated: '2024-11-24'
  },

  // ALTAN (ROT)
  {
    jobType: 'altan',
    category: 'rot',
    unitType: 'kvm',
    requiredInput: ['area'],
    timePerUnit: { simple: 2.0, normal: 3.5, complex: 5.0 },
    multipliers: {
      accessibility: { easy: 0.9, normal: 1.0, hard: 1.3 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.5 }
    },
    hourlyRateRange: { min: 550, typical: 650, max: 800 },
    materialRatio: 0.5,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Tryckimpregnerat'] },
      standard: { priceMultiplier: 1.0, examples: ['Premium trall'] },
      premium: { priceMultiplier: 2.5, examples: ['Komposit', 'Ädelträ'] }
    },
    priceBounds: { minPerUnit: 1500, maxPerUnit: 4000, totalMin: 5000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Plintar & Bärlinor', mandatory: true, typicalHours: 1.2, perUnit: true },
      { name: 'Tralläggning', mandatory: true, typicalHours: 1.5, perUnit: true },
      { name: 'Kjolar/Räcken', mandatory: false, typicalHours: 0.8, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Virke & Skruv', unit: 'lpm', formula: 'unitQty * 8.5', pricePerUnit: { budget: 25, standard: 45, premium: 120 } },
      { name: 'Plintar & Betong', unit: 'st', formula: 'Math.ceil(unitQty / 2)', pricePerUnit: { budget: 100, standard: 150, premium: 200 } }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    questionTemplates: {
      unitQty: 'Hur stor altan vill du bygga (kvm)?',
      complexity: 'Ska det vara räcken eller trappor?',
      accessibility: 'Är marken förberedd?',
      qualityLevel: 'Standardtrall eller lyxigare virke?'
    },
    source: 'Svenskt Trä',
    lastUpdated: '2024-11-24'
  },

  // ==========================================
  // 2. RUT-TJÄNSTER (50% Avdrag)
  // ==========================================

  // FLYTTSTÄDNING
  {
    jobType: 'flyttstadning',
    category: 'rut',
    unitType: 'kvm',
    requiredInput: ['area'],
    timePerUnit: { simple: 0.15, normal: 0.18, complex: 0.25 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.3 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.1 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.2 }
    },
    hourlyRateRange: { min: 350, typical: 450, max: 550 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 1.0, examples: ['Standard'] },
      standard: { priceMultiplier: 1.0, examples: ['Proffs'] },
      premium: { priceMultiplier: 1.0, examples: ['Miljö'] }
    },
    priceBounds: { minPerUnit: 60, maxPerUnit: 140, totalMin: 2000, totalMax: 15000 },
    standardWorkItems: [
      { name: 'Grundstädning', mandatory: true, typicalHours: 0.14, perUnit: true },
      { name: 'Fönsterputs', mandatory: true, typicalHours: 0.04, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Städmaterial & Medel', unit: 'set', formula: '1', pricePerUnit: { budget: 200, standard: 350, premium: 500 } }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur stor är bostaden (kvm)?',
      complexity: 'Ingår biytor/balkong?',
      accessibility: 'Finns hiss?',
      qualityLevel: 'Standard'
    },
    source: 'Almega',
    lastUpdated: '2024-11-24'
  },

  // FALLBACK (OM INGET MATCHAR)
  {
    jobType: 'ai_driven',
    category: 'none',
    unitType: 'tim',
    requiredInput: ['jobType'],
    timePerUnit: { simple: 1, normal: 1, complex: 1.3 },
    multipliers: { accessibility: { easy: 1, normal: 1, hard: 1.2 }, quality: { budget: 1, standard: 1, premium: 1.2 }, complexity: { simple: 1, normal: 1, complex: 1.2 } },
    hourlyRateRange: { min: 500, typical: 650, max: 900 },
    materialRatio: 0.2,
    materialBuckets: { budget: {priceMultiplier:1, examples:[]}, standard: {priceMultiplier:1, examples:[]}, premium: {priceMultiplier:1, examples:[]} },
    priceBounds: { minPerUnit: 500, maxPerUnit: 1500, totalMin: 1000, totalMax: 500000 },
    standardWorkItems: [],
    applicableDeduction: 'none',
    deductionPercentage: 0,
    questionTemplates: { unitQty: '?', complexity: '?', accessibility: '?', qualityLevel: '?' },
    source: 'Fallback',
    lastUpdated: '2024-11-24'
  }
];

// Helper functions
export function findJobDefinition(jobType: string, supabase?: any): JobDefinition | null {
  const normalized = jobType.toLowerCase().trim();
  
  // Försök matcha exakt eller innehåll
  let found = JOB_REGISTRY.find(j => j.jobType.toLowerCase() === normalized);
  if (found) return found;
  
  // Målning special - fånga alla varianter
  if (normalized.includes('måla') || normalized.includes('färg') || normalized.includes('tapet')) {
    return JOB_REGISTRY.find(j => j.jobType === 'målning') || null;
  }

  // Badrum special
  if (normalized.includes('badrum') || normalized.includes('dusch') || normalized.includes('wc')) {
    return JOB_REGISTRY.find(j => j.jobType === 'badrum') || null;
  }

  found = JOB_REGISTRY.find(j => normalized.includes(j.jobType.toLowerCase()));
  if (found) return found;
  
  return JOB_REGISTRY.find(j => j.jobType === 'ai_driven') || null;
}

export function getJobDefinition(jobCategory: string): JobDefinition {
  return findJobDefinition(jobCategory) || JOB_REGISTRY[JOB_REGISTRY.length - 1];
}
