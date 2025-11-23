// ============================================================================
// JOB REGISTRY - FAS 0: DATA-DRIVEN JOBBDEFINITIONER
// ============================================================================

export interface JobDefinition {
  jobType: string;
  category: 'rot' | 'rut' | 'none';
  unitType: 'kvm' | 'lm' | 'st' | 'tim';
  requiredInput?: string[]; // Fält som MÅSTE finnas (triggar frågor)

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
  // 1. RUT-TJÄNSTER (50% avdrag)
  // ==========================================

  // STÄDNING
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
    materialRatio: 0.0,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Standard'] },
      standard: { priceMultiplier: 1.0, examples: ['Proffs'] },
      premium: { priceMultiplier: 1.25, examples: ['Miljö'] }
    },
    priceBounds: { minPerUnit: 60, maxPerUnit: 140, totalMin: 2000, totalMax: 15000 },
    standardWorkItems: [
      { name: 'Grundstädning', mandatory: true, typicalHours: 0.15, perUnit: true },
      { name: 'Fönsterputs', mandatory: false, typicalHours: 0.04, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Städmaterial', unit: 'set', formula: '1', pricePerUnit: { budget: 300, standard: 500, premium: 800 } }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm ska städas?',
      complexity: 'Tomt eller möblerat?',
      accessibility: 'Våning/Hiss?',
      qualityLevel: 'Standard?'
    },
    source: 'Hemfrid 2025',
    lastUpdated: '2025-11-21'
  },

  // TRÄDGÅRD
  {
    jobType: 'trädgård',
    category: 'rut',
    unitType: 'kvm', // Eller timmar
    timePerUnit: { simple: 0.05, normal: 0.1, complex: 0.2 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.4 },
      quality: { budget: 1.0, standard: 1.0, premium: 1.0 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.5 }
    },
    hourlyRateRange: { min: 350, typical: 500, max: 650 },
    materialRatio: 0.1,
    materialBuckets: {
      budget: { priceMultiplier: 1.0, examples: [] },
      standard: { priceMultiplier: 1.0, examples: [] },
      premium: { priceMultiplier: 1.0, examples: [] }
    },
    priceBounds: { minPerUnit: 10, maxPerUnit: 500, totalMin: 1000, totalMax: 50000 },
    standardWorkItems: [
      { name: 'Trädgårdsarbete', mandatory: true, typicalHours: 0.1, perUnit: true }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur stor yta gäller det?',
      complexity: 'Klippning eller rensning?',
      accessibility: 'Slänt eller plant?',
      qualityLevel: 'Standard'
    },
    seasonSensitive: true,
    source: 'Webben',
    lastUpdated: '2025-11-21'
  },

  // SNÖSKOTTNING
  {
    jobType: 'snöröjning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.02, normal: 0.04, complex: 0.08 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 1.0, standard: 1.0, premium: 1.0 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.5 }
    },
    hourlyRateRange: { min: 400, typical: 550, max: 750 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 1.0, examples: [] },
      standard: { priceMultiplier: 1.0, examples: ['Sand/Salt'] },
      premium: { priceMultiplier: 1.0, examples: [] }
    },
    priceBounds: { minPerUnit: 10, maxPerUnit: 100, totalMin: 500, totalMax: 10000 },
    standardWorkItems: [
      { name: 'Snöskottning', mandatory: true, typicalHours: 0.04, perUnit: true }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Yta att skotta?',
      complexity: 'Tung snö?',
      accessibility: 'Tak eller mark?',
      qualityLevel: 'Standard'
    },
    seasonSensitive: true,
    source: 'Webben',
    lastUpdated: '2025-11-21'
  },

  // FLYTTHJÄLP
  {
    jobType: 'flytthjalp',
    category: 'rut',
    unitType: 'tim',
    requiredInput: ['area'], // Area ger bra uppskattning av volym
    timePerUnit: { simple: 0.2, normal: 0.3, complex: 0.5 }, 
    multipliers: {
      accessibility: { easy: 0.8, normal: 1.0, hard: 1.5 },
      quality: { budget: 1.0, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 600, max: 900 },
    materialRatio: 0.0,
    materialBuckets: {
      budget: { priceMultiplier: 1.0, examples: [] },
      standard: { priceMultiplier: 1.0, examples: ['Lånekartonger'] },
      premium: { priceMultiplier: 1.0, examples: ['Köpkartonger'] }
    },
    priceBounds: { minPerUnit: 100, maxPerUnit: 500, totalMin: 3000, totalMax: 30000 },
    standardWorkItems: [
      { name: 'Bärhjälp', mandatory: true, typicalHours: 0.2, perUnit: true },
      { name: 'Packning', mandatory: false, typicalHours: 0.15, perUnit: true }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    serviceVehicle: { threshold: 1, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Bostadens yta (kvm)?',
      complexity: 'Tunga möbler?',
      accessibility: 'Hiss?',
      qualityLevel: 'Bara flytt eller packning?'
    },
    source: 'Flyttbranschen',
    lastUpdated: '2025-11-21'
  },

  // IT-TJÄNSTER
  {
    jobType: 'it_support',
    category: 'rut',
    unitType: 'tim',
    timePerUnit: { simple: 1, normal: 2, complex: 4 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.0, hard: 1.0 },
      quality: { budget: 1.0, standard: 1.0, premium: 1.0 },
      complexity: { simple: 1.0, normal: 1.5, complex: 2.0 }
    },
    hourlyRateRange: { min: 600, typical: 900, max: 1200 },
    materialRatio: 0.0,
    materialBuckets: { budget: {priceMultiplier:1, examples:[]}, standard: {priceMultiplier:1, examples:[]}, premium: {priceMultiplier:1, examples:[]} },
    priceBounds: { minPerUnit: 600, maxPerUnit: 5000, totalMin: 600, totalMax: 10000 },
    standardWorkItems: [
      { name: 'IT-support i hemmet', mandatory: true, typicalHours: 1.5, perUnit: false }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: { unitQty: 'Timmar?', complexity: 'Problem?', accessibility: 'På plats?', qualityLevel: 'Standard' },
    source: 'Skatteverket',
    lastUpdated: '2025-11-21'
  },

  // REPARATION VITVAROR
  {
    jobType: 'reparation_vitvaror',
    category: 'rut',
    unitType: 'st',
    timePerUnit: { simple: 1, normal: 2, complex: 3 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.0, hard: 1.3 },
      quality: { budget: 1.0, standard: 1.0, premium: 1.0 },
      complexity: { simple: 1.0, normal: 1.5, complex: 2.0 }
    },
    hourlyRateRange: { min: 800, typical: 1100, max: 1500 },
    materialRatio: 0.4, // Reservdelar
    materialBuckets: { budget: {priceMultiplier:1, examples:[]}, standard: {priceMultiplier:1, examples:[]}, premium: {priceMultiplier:1, examples:[]} },
    priceBounds: { minPerUnit: 1000, maxPerUnit: 6000, totalMin: 1000, totalMax: 8000 },
    standardWorkItems: [
      { name: 'Felsökning och reparation', mandatory: true, typicalHours: 1.5, perUnit: true }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: { unitQty: 'Antal maskiner?', complexity: 'Fel?', accessibility: 'Inbyggd?', qualityLevel: 'Standard' },
    source: 'Skatteverket',
    lastUpdated: '2025-11-21'
  },

  // ==========================================
  // 2. ROT-TJÄNSTER (30% i grunden, men 50% 2024)
  // ==========================================

  // MÅLNING
  {
    jobType: 'målning',
    category: 'rot',
    unitType: 'kvm',
    requiredInput: ['area', 'complexity'],
    timePerUnit: { simple: 0.3, normal: 0.4, complex: 0.6 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.2,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Lågpris'] },
      standard: { priceMultiplier: 1.0, examples: ['Nordsjö/Jotun'] },
      premium: { priceMultiplier: 1.4, examples: ['Eko/Premium'] }
    },
    priceBounds: { minPerUnit: 150, maxPerUnit: 400, totalMin: 5000, totalMax: 80000 },
    standardWorkItems: [
      { name: 'Förberedelser', mandatory: true, typicalHours: 0.08, perUnit: true },
      { name: 'Spackling', mandatory: true, typicalHours: 0.08, perUnit: true },
      { name: 'Målning', mandatory: true, typicalHours: 0.28, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Färg', unit: 'liter', formula: 'unitQty / 6', pricePerUnit: { budget: 150, standard: 250, premium: 400 } },
      { name: 'Spackel/Material', unit: 'set', formula: '1', pricePerUnit: { budget: 300, standard: 500, premium: 800 } }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30, // Grundinställning (överskrivs av datum-regeln i Pipeline)
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'halv' },
    questionTemplates: {
      unitQty: 'Väggyta (kvm)?',
      complexity: 'Mycket spackling?',
      accessibility: 'Takhöjd?',
      qualityLevel: 'Färgval?'
    },
    source: 'Målarförbundet',
    lastUpdated: '2025-11-21'
  },

  // BADRUM
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
    hourlyRateRange: { min: 550, typical: 750, max: 950 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standard'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklass'] },
      premium: { priceMultiplier: 1.6, examples: ['Lyx'] }
    },
    priceBounds: { minPerUnit: 15000, maxPerUnit: 75000, totalMin: 60000, totalMax: 350000 },
    standardWorkItems: [
      { name: 'Rivning', mandatory: true, typicalHours: 2.2, perUnit: true },
      { name: 'VVS/El/Golv/Vägg', mandatory: true, typicalHours: 7.8, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Kakel/Klinker', unit: 'kvm', formula: 'unitQty * 2.5', pricePerUnit: { budget: 300, standard: 600, premium: 1200 } },
      { name: 'Inredning/VVS', unit: 'pkt', formula: '1', pricePerUnit: { budget: 10000, standard: 25000, premium: 60000 } }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: { unitQty: 'Golvyta (kvm)?', complexity: 'Totalrenovering?', accessibility: 'Våning?', qualityLevel: 'Lyx?' },
    source: 'Byggfakta',
    lastUpdated: '2025-11-21'
  },

  // EL
  {
    jobType: 'el',
    category: 'rot',
    unitType: 'tim',
    timePerUnit: { simple: 1, normal: 1, complex: 1 },
    multipliers: { accessibility: { easy: 1, normal: 1, hard: 1.2 }, quality: { budget: 1, standard: 1, premium: 1.2 }, complexity: { simple: 1, normal: 1, complex: 1 } },
    hourlyRateRange: { min: 650, typical: 850, max: 1100 },
    materialRatio: 0.3,
    materialBuckets: { budget: {priceMultiplier:1, examples:[]}, standard: {priceMultiplier:1, examples:[]}, premium: {priceMultiplier:1, examples:[]} },
    priceBounds: { minPerUnit: 650, maxPerUnit: 1500, totalMin: 1000, totalMax: 500000 },
    standardWorkItems: [{ name: 'Elinstallation', mandatory: true, typicalHours: 1, perUnit: true }],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 2, autoInclude: true, unit: 'dag' },
    questionTemplates: { unitQty: 'Timmar?', complexity: '?', accessibility: '?', qualityLevel: '?' },
    source: 'El',
    lastUpdated: '2025-11-21'
  },

  // VVS
  {
    jobType: 'vvs',
    category: 'rot',
    unitType: 'tim',
    timePerUnit: { simple: 1, normal: 1, complex: 1 },
    multipliers: { accessibility: { easy: 1, normal: 1, hard: 1.2 }, quality: { budget: 1, standard: 1, premium: 1.2 }, complexity: { simple: 1, normal: 1, complex: 1 } },
    hourlyRateRange: { min: 700, typical: 900, max: 1200 },
    materialRatio: 0.3,
    materialBuckets: { budget: {priceMultiplier:1, examples:[]}, standard: {priceMultiplier:1, examples:[]}, premium: {priceMultiplier:1, examples:[]} },
    priceBounds: { minPerUnit: 700, maxPerUnit: 1500, totalMin: 1000, totalMax: 500000 },
    standardWorkItems: [{ name: 'VVS-installation', mandatory: true, typicalHours: 1, perUnit: true }],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 2, autoInclude: true, unit: 'dag' },
    questionTemplates: { unitQty: 'Timmar?', complexity: '?', accessibility: '?', qualityLevel: '?' },
    source: 'VVS',
    lastUpdated: '2025-11-21'
  },

  // ALTAN & SNICKERI
  {
    jobType: 'altan_bygg',
    category: 'rot',
    unitType: 'kvm',
    requiredInput: ['area'],
    timePerUnit: { simple: 2.5, normal: 4.0, complex: 6.0 },
    multipliers: {
      accessibility: { easy: 0.9, normal: 1.0, hard: 1.3 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.5 }
    },
    hourlyRateRange: { min: 600, typical: 750, max: 950 },
    materialRatio: 0.6,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Tryckimpregnerat'] },
      standard: { priceMultiplier: 1.0, examples: ['Bättre trall'] },
      premium: { priceMultiplier: 2.5, examples: ['Komposit/Ädelträ'] }
    },
    priceBounds: { minPerUnit: 1500, maxPerUnit: 5000, totalMin: 10000, totalMax: 300000 },
    standardWorkItems: [
      { name: 'Plintar/Bärlinor', mandatory: true, typicalHours: 1.5, perUnit: true },
      { name: 'Tralläggning', mandatory: true, typicalHours: 1.5, perUnit: true }
    ],
    materialCalculations: [
      { name: 'Virke & Skruv', unit: 'kvm', formula: 'unitQty * 1.1', pricePerUnit: { budget: 500, standard: 900, premium: 2500 } }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: { unitQty: 'Altanens yta?', complexity: 'Räcke/Trappa?', accessibility: 'Markarbete?', qualityLevel: 'Material?' },
    source: 'Svenskt Trä',
    lastUpdated: '2025-11-21'
  },

  // FALLBACK
  {
    jobType: 'ai_driven',
    category: 'none',
    unitType: 'tim',
    requiredInput: ['jobType'],
    timePerUnit: { simple: 1, normal: 1, complex: 1.3 },
    multipliers: { accessibility: { easy: 1, normal: 1, hard: 1.2 }, quality: { budget: 1, standard: 1, premium: 1.2 }, complexity: { simple: 1, normal: 1, complex: 1.2 } },
    hourlyRateRange: { min: 500, typical: 750, max: 1000 },
    materialRatio: 0.3,
    materialBuckets: { budget: {priceMultiplier:1, examples:[]}, standard: {priceMultiplier:1, examples:[]}, premium: {priceMultiplier:1, examples:[]} },
    priceBounds: { minPerUnit: 500, maxPerUnit: 1500, totalMin: 1000, totalMax: 500000 },
    standardWorkItems: [],
    applicableDeduction: 'none',
    deductionPercentage: 0,
    serviceVehicle: { threshold: 4, autoInclude: false, unit: 'dag' },
    questionTemplates: { unitQty: '?', complexity: '?', accessibility: '?', qualityLevel: '?' },
    source: 'Fallback',
    lastUpdated: '2025-11-21'
  }
];

// Helper functions (behåll samma som tidigare)
export function findJobDefinition(jobType: string, supabase?: any): JobDefinition | null {
  const normalized = jobType.toLowerCase().trim();
  let found = JOB_REGISTRY.find(j => j.jobType.toLowerCase() === normalized);
  if (found) return found;
  
  found = JOB_REGISTRY.find(j => normalized.includes(j.jobType.toLowerCase()));
  if (found) return found;
  
  return JOB_REGISTRY.find(j => j.jobType === 'ai_driven') || null;
}

export function getJobDefinition(jobCategory: string): JobDefinition {
  return findJobDefinition(jobCategory) || JOB_REGISTRY[JOB_REGISTRY.length - 1];
}
