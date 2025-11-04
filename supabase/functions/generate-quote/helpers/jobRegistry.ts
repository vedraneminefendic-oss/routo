// ============================================================================
// JOB REGISTRY - FAS 0: DATA-DRIVEN JOBBDEFINITIONER
// ============================================================================

export interface JobDefinition {
  jobType: string;
  category: 'rot' | 'rut' | 'none';
  
  // Universella dimensioner (OBLIGATORISKA)
  unitType: 'kvm' | 'lm' | 'st' | 'tim';
  
  // Tidsberäkning med tre nivåer
  timePerUnit: {
    simple: number;    // Enkel (inga hinder)
    normal: number;    // Standard
    complex: number;   // Komplex (svåråtkomligt, mycket prep)
  };
  
  // Kontextuella multiplikatorer
  multipliers: {
    accessibility: { easy: number; normal: number; hard: number };
    quality: { budget: number; standard: number; premium: number };
    complexity: { simple: number; normal: number; complex: number };
  };
  
  // Prissättning
  hourlyRateRange: { min: number; typical: number; max: number };
  materialRatio: number;  // 0-1 (0.35 = 35% av arbetskostnad)
  
  // Material buckets (NYA)
  materialBuckets: {
    budget: { priceMultiplier: number; examples: string[] };
    standard: { priceMultiplier: number; examples: string[] };
    premium: { priceMultiplier: number; examples: string[] };
  };
  
  // Validering (total-guard)
  priceBounds: {
    minPerUnit: number;
    maxPerUnit: number;
    totalMin: number;
    totalMax: number;
  };
  
  // Standardmoment
  standardWorkItems: Array<{
    name: string;
    mandatory: boolean;
    typicalHours: number;
  }>;
  
  // ROT/RUT (med korrekta satser)
  applicableDeduction: 'rot' | 'rut' | 'none';
  deductionPercentage: number;  // ROT=30, RUT=50
  
  // Servicebil-regler (NYA)
  serviceVehicle?: {
    threshold: number;      // t.ex. 4 timmar
    autoInclude: boolean;   // true = lägg till automatiskt
    unit: 'dag' | 'halv';   // prissättningsenhet
  };
  
  // Frågemallar (för manage-conversation)
  questionTemplates: {
    unitQty: string;
    complexity: string;
    accessibility: string;
    qualityLevel: string;
  };
  
  // Region & Säsong (NYA FÖR PUNKT 1)
  regionSensitive?: boolean;  // Om priset ska påverkas av region (default: true)
  seasonSensitive?: boolean;  // Om priset ska påverkas av säsong (default: true)
  
  // Metadata
  source: string;
  lastUpdated: string;
}

// ============================================================================
// JOB REGISTRY - Alla jobbtyper
// ============================================================================

export const JOB_REGISTRY: JobDefinition[] = [
  // STÄDNING
  {
    jobType: 'flyttstadning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.15, normal: 0.18, complex: 0.25 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.3 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.1 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.2 }
    },
    hourlyRateRange: { min: 350, typical: 450, max: 550 },
    materialRatio: 0.0,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Vanliga städmedel'] },
      standard: { priceMultiplier: 1.0, examples: ['Professionella städmedel'] },
      premium: { priceMultiplier: 1.25, examples: ['Miljövänliga premiummedel'] }
    },
    priceBounds: { 
      minPerUnit: 60,
      maxPerUnit: 140,
      totalMin: 2000, 
      totalMax: 15000 
    },
    standardWorkItems: [
      { name: 'Grundstädning', mandatory: true, typicalHours: 0.18 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    serviceVehicle: undefined,
    questionTemplates: {
      unitQty: 'Hur många kvm ska städas?',
      complexity: 'Är ytan tom eller mycket möblerad?',
      accessibility: 'Vilken våning? (påverkar pris om hiss saknas)',
      qualityLevel: 'Standard- eller grundligstädning?'
    },
    source: 'Webben (Hemfrid, Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },

  // BADRUMSRENOVERING
  {
    jobType: 'badrum',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 35, normal: 50, complex: 70 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 550, typical: 750, max: 950 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standardkakel 200-400 kr/kvm', 'Basic inredning'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklasskakel 400-800 kr/kvm', 'Standardinredning'] },
      premium: { priceMultiplier: 1.6, examples: ['Premiumkakel 800+ kr/kvm', 'Designinredning'] }
    },
    priceBounds: {
      minPerUnit: 15000,
      maxPerUnit: 75000,
      totalMin: 60000,
      totalMax: 350000
    },
    standardWorkItems: [
      { name: 'Rivning och demontering', mandatory: true, typicalHours: 12 },
      { name: 'Golvarbete och vattenisolering', mandatory: true, typicalHours: 16 },
      { name: 'Kakelsättning', mandatory: true, typicalHours: 24 },
      { name: 'Installation av inredning', mandatory: true, typicalHours: 8 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: {
      threshold: 4,
      autoInclude: true,
      unit: 'dag'
    },
    questionTemplates: {
      unitQty: 'Hur många kvm är badrummet?',
      complexity: 'Totalrenovering eller partiell upprustning?',
      accessibility: 'Källare, bottenvåning eller övervåning?',
      qualityLevel: 'Budget-, standard- eller premiumkakel och inredning?'
    },
    source: 'Webben (Byggfakta, Svensk Byggtjänst 2025)',
    lastUpdated: '2025-11-04'
  },

  // KÖKSRENOVERING
  {
    jobType: 'kök',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 80, normal: 120, complex: 180 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.25 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.5 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.35 }
    },
    hourlyRateRange: { min: 600, typical: 750, max: 900 },
    materialRatio: 0.55,
    materialBuckets: {
      budget: { priceMultiplier: 0.65, examples: ['IKEA-kök', 'Laminatbänkskiva'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklasssnickeri', 'Kompositbänkskiva'] },
      premium: { priceMultiplier: 1.8, examples: ['Specialsnickeri', 'Naturstenbänkskiva'] }
    },
    priceBounds: {
      minPerUnit: 80000,
      maxPerUnit: 400000,
      totalMin: 80000,
      totalMax: 400000
    },
    standardWorkItems: [
      { name: 'Rivning och demontering', mandatory: true, typicalHours: 16 },
      { name: 'El- och rörarbete', mandatory: true, typicalHours: 24 },
      { name: 'Montering köksinredning', mandatory: true, typicalHours: 32 },
      { name: 'Installation vitvaror', mandatory: false, typicalHours: 8 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: {
      threshold: 4,
      autoInclude: true,
      unit: 'dag'
    },
    questionTemplates: {
      unitQty: 'Hur stort är köket (ange antal skåp alternativt kvm)?',
      complexity: 'Totalrenovering eller bara byte av inredning?',
      accessibility: 'Vilken våning? Finns hiss?',
      qualityLevel: 'IKEA-kök, mellanklass eller specialsnickeri?'
    },
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },

  // MÅLNING
  {
    jobType: 'målning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.3, normal: 0.4, complex: 0.6 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.2,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Standardfärg från bygghandel'] },
      standard: { priceMultiplier: 1.0, examples: ['Beckers, Alcro'] },
      premium: { priceMultiplier: 1.4, examples: ['Miljömärkta premiumfärger'] }
    },
    priceBounds: {
      minPerUnit: 150,
      maxPerUnit: 400,
      totalMin: 5000,
      totalMax: 80000
    },
    standardWorkItems: [
      { name: 'Förberedelse (spackling, slipning)', mandatory: true, typicalHours: 0.15 },
      { name: 'Målning', mandatory: true, typicalHours: 0.25 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    serviceVehicle: {
      threshold: 4,
      autoInclude: true,
      unit: 'halv'
    },
    questionTemplates: {
      unitQty: 'Hur många kvm ska målas (väggar + tak)?',
      complexity: 'Behövs spackling och slipning, eller bara målning?',
      accessibility: 'Takhöjd? Möbler som ska skyddas?',
      qualityLevel: 'Standard-, miljömärkt eller premiumfärg?'
    },
    source: 'Webben (Målarföretagen, Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },

  // TRÄDGÅRD
  {
    jobType: 'trädgård',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.5, normal: 0.8, complex: 1.2 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.4 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.35 }
    },
    hourlyRateRange: { min: 350, typical: 450, max: 600 },
    materialRatio: 0.25,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Standardväxter från bygghandel'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklassväxter från plantskola'] },
      premium: { priceMultiplier: 1.5, examples: ['Designväxter, specialbeställda'] }
    },
    priceBounds: {
      minPerUnit: 200,
      maxPerUnit: 800,
      totalMin: 3000,
      totalMax: 100000
    },
    standardWorkItems: [
      { name: 'Markberedning', mandatory: false, typicalHours: 0.3 },
      { name: 'Plantering', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    serviceVehicle: {
      threshold: 4,
      autoInclude: true,
      unit: 'dag'
    },
    questionTemplates: {
      unitQty: 'Hur stor yta ska hanteras (kvm)?',
      complexity: 'Enkel skötsel eller nyplantering/omläggning?',
      accessibility: 'Lätt åtkomst eller svårt terräng?',
      qualityLevel: 'Standardväxter eller specialbeställda?'
    },
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },

  // FALLBACK (AI-DRIVEN)
  {
    jobType: 'ai_driven',
    category: 'none',
    unitType: 'tim',
    timePerUnit: { simple: 0.8, normal: 1.0, complex: 1.3 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.25 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.25 }
    },
    hourlyRateRange: { min: 450, typical: 650, max: 850 },
    materialRatio: 0.3,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: [] },
      standard: { priceMultiplier: 1.0, examples: [] },
      premium: { priceMultiplier: 1.3, examples: [] }
    },
    priceBounds: {
      minPerUnit: 450,
      maxPerUnit: 1100,
      totalMin: 1000,
      totalMax: 500000
    },
    standardWorkItems: [],
    applicableDeduction: 'none',
    deductionPercentage: 0,
    serviceVehicle: {
      threshold: 4,
      autoInclude: false,
      unit: 'dag'
    },
    questionTemplates: {
      unitQty: 'Hur stor är arbetsytan eller antal enheter?',
      complexity: 'Enkelt, normalt eller komplext arbete?',
      accessibility: 'Hur lätt är det att komma åt arbetsområdet?',
      qualityLevel: 'Budget-, standard- eller premiumkvalitet?'
    },
    source: 'AI-genererad fallback',
    lastUpdated: '2025-11-04'
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Hitta jobbdefinition baserat på jobbtyp med tracking
 */
export function findJobDefinition(jobType: string, supabase?: any): JobDefinition | null {
  const normalized = jobType.toLowerCase().trim();
  
  // Exakt match
  let found = JOB_REGISTRY.find(j => j.jobType.toLowerCase() === normalized);
  
  if (found) {
    if (supabase) logJobMatch(jobType, found.jobType, 'exact', supabase);
    return found;
  }
  
  // Partiell match (innehåller)
  found = JOB_REGISTRY.find(j => 
    normalized.includes(j.jobType.toLowerCase()) || 
    j.jobType.toLowerCase().includes(normalized)
  );
  
  if (found) {
    if (supabase) logJobMatch(jobType, found.jobType, 'partial', supabase);
    return found;
  }
  
  // Fallback till AI-driven
  console.log(`⚠️ No specific job definition found for "${jobType}", using AI-driven fallback`);
  if (supabase) logJobMatch(jobType, 'ai_driven', 'fallback', supabase);
  return JOB_REGISTRY.find(j => j.jobType === 'ai_driven') || null;
}

/**
 * Logga jobbmatchningar för observability (90% täckning-mål)
 */
async function logJobMatch(userInput: string, matchedType: string, matchType: string, supabase: any) {
  try {
    await supabase.from('job_registry_matches').insert({
      user_input: userInput,
      matched_type: matchedType,
      match_type: matchType
    });
  } catch (e) {
    // Logga inte fel - ska inte påverka huvudflödet
  }
}

/**
 * Beräkna användarviktning baserat på antal offerter
 */
export function calculateUserWeighting(totalQuotes: number): number {
  // 0 offerter = 0% user weight (100% web)
  // 5 offerter = 25% user weight
  // 10 offerter = 50% user weight
  // 20+ offerter = 100% user weight
  return Math.min(100, (totalQuotes / 20) * 100);
}
