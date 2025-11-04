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
    regionSensitive: false,
    seasonSensitive: false,
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
      { name: 'VVS-installation', mandatory: true, typicalHours: 10 },
      { name: 'El-installation', mandatory: true, typicalHours: 12 },
      { name: 'Kakel backsplash', mandatory: false, typicalHours: 8 },
      { name: 'Montering köksinredning', mandatory: true, typicalHours: 36 },
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
    regionSensitive: true,
    seasonSensitive: false,
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
      { name: 'Förberedelse och skydd', mandatory: true, typicalHours: 0.05 },
      { name: 'Spackling och slipning', mandatory: true, typicalHours: 0.12 },
      { name: 'Grundning', mandatory: false, typicalHours: 0.10 },
      { name: 'Målning 1:a lagret', mandatory: true, typicalHours: 0.14 },
      { name: 'Målning 2:a lagret', mandatory: true, typicalHours: 0.10 },
      { name: 'Städning och efterarbete', mandatory: true, typicalHours: 0.03 }
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
    regionSensitive: false,
    seasonSensitive: false,
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
      { name: 'Markberedning', mandatory: false, typicalHours: 0.4 },
      { name: 'Plantering', mandatory: true, typicalHours: 0.5 },
      { name: 'Gräsklippning', mandatory: false, typicalHours: 0.003 },
      { name: 'Häckklippning', mandatory: false, typicalHours: 0.10 }
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
    regionSensitive: false,
    seasonSensitive: true,
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },

  // PUTS & FASAD
  {
    jobType: 'puts_fasad',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 1.5, normal: 2.0, complex: 3.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 500, typical: 650, max: 850 },
    materialRatio: 0.35,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Standardputs'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsputs'] },
      premium: { priceMultiplier: 1.4, examples: ['Premiumputs med specialfinish'] }
    },
    priceBounds: { minPerUnit: 800, maxPerUnit: 2500, totalMin: 15000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Förberedelse och rengöring', mandatory: true, typicalHours: 0.5 },
      { name: 'Putsning', mandatory: true, typicalHours: 1.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm fasad ska putsas?',
      complexity: 'Enkel yta eller med detaljer/prydnader?',
      accessibility: 'Vilken höjd? Behövs ställning?',
      qualityLevel: 'Standard- eller premiumputs?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'spackling_väggar',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.2, normal: 0.3, complex: 0.5 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.3 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.15,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Standardspackel'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsspackel'] },
      premium: { priceMultiplier: 1.3, examples: ['Premiumspackel'] }
    },
    priceBounds: { minPerUnit: 80, maxPerUnit: 300, totalMin: 2000, totalMax: 50000 },
    standardWorkItems: [
      { name: 'Slipning', mandatory: true, typicalHours: 0.1 },
      { name: 'Spackling', mandatory: true, typicalHours: 0.2 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm vägg ska spacklas?',
      complexity: 'Små sprickor eller större skador?',
      accessibility: 'Normal takhöjd eller högre?',
      qualityLevel: 'Standard eller extra fin finish?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Målarföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'fasadmålning',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 0.4, normal: 0.6, complex: 0.9 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.25, hard: 1.6 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 450, typical: 600, max: 800 },
    materialRatio: 0.3,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Standardfasadfärg'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsfasadfärg'] },
      premium: { priceMultiplier: 1.5, examples: ['Premiumfasadfärg med lång hållbarhet'] }
    },
    priceBounds: { minPerUnit: 200, maxPerUnit: 700, totalMin: 10000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Rengöring fasad', mandatory: true, typicalHours: 0.12 },
      { name: 'Förberedelse och spackling', mandatory: true, typicalHours: 0.08 },
      { name: 'Målning fasad', mandatory: true, typicalHours: 0.35 },
      { name: 'Ställning', mandatory: false, typicalHours: 0 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm fasad ska målas?',
      complexity: 'Slät yta eller med detaljer?',
      accessibility: 'Vilken höjd? Behövs ställning/lift?',
      qualityLevel: 'Standard- eller premiumfärg?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },

  // GOLV
  {
    jobType: 'parkettläggning',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 1.0, normal: 1.5, complex: 2.5 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.3 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.35 }
    },
    hourlyRateRange: { min: 500, typical: 650, max: 850 },
    materialRatio: 0.5,
    materialBuckets: {
      budget: { priceMultiplier: 0.6, examples: ['Standardparkett 200-400 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklassparkett 400-700 kr/kvm'] },
      premium: { priceMultiplier: 1.8, examples: ['Premiumparkett 700+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 600, maxPerUnit: 2500, totalMin: 10000, totalMax: 150000 },
    standardWorkItems: [
      { name: 'Underlagsarbete', mandatory: true, typicalHours: 0.25 },
      { name: 'Läggning parkett', mandatory: true, typicalHours: 0.8 },
      { name: 'Slipning', mandatory: false, typicalHours: 0.25 },
      { name: 'Lackering', mandatory: false, typicalHours: 0.25 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm parkett ska läggas?',
      complexity: 'Raka rum eller komplicerad layout?',
      accessibility: 'Vilken våning? Hiss?',
      qualityLevel: 'Budget-, standard- eller premiumparkett?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'klinkerläggning',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 2.0, normal: 3.0, complex: 4.5 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.5 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 550, typical: 700, max: 900 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.65, examples: ['Standardklinker 200-400 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklassklinker 400-700 kr/kvm'] },
      premium: { priceMultiplier: 1.7, examples: ['Premiumklinker 700+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 800, maxPerUnit: 3500, totalMin: 8000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Förberedelse underlag', mandatory: true, typicalHours: 0.8 },
      { name: 'Läggning klinker', mandatory: true, typicalHours: 2.0 },
      { name: 'Fogning', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm klinker ska läggas?',
      complexity: 'Rakt mönster eller komplicerat?',
      accessibility: 'Golv eller vägg? Våning?',
      qualityLevel: 'Budget-, standard- eller premiumklinker?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'mattläggning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.4, normal: 0.6, complex: 0.9 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.25 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.4,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standardmatta 100-200 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklasmatta 200-400 kr/kvm'] },
      premium: { priceMultiplier: 1.6, examples: ['Premiummatta 400+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 250, maxPerUnit: 900, totalMin: 3000, totalMax: 80000 },
    standardWorkItems: [
      { name: 'Förberedelse underlag', mandatory: true, typicalHours: 0.2 },
      { name: 'Läggning matta', mandatory: true, typicalHours: 0.4 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm matta ska läggas?',
      complexity: 'Raka rum eller trappor/komplicerad layout?',
      accessibility: 'Vilken våning?',
      qualityLevel: 'Budget-, standard- eller premiummatta?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Golvbranschen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'vinylgolv',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.6, normal: 0.9, complex: 1.3 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.25 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 450, typical: 550, max: 700 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standardvinyl 150-300 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklassvinyl 300-500 kr/kvm'] },
      premium: { priceMultiplier: 1.6, examples: ['Premiumvinyl 500+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 350, maxPerUnit: 1200, totalMin: 5000, totalMax: 100000 },
    standardWorkItems: [
      { name: 'Förberedelse underlag', mandatory: true, typicalHours: 0.3 },
      { name: 'Läggning vinyl', mandatory: true, typicalHours: 0.6 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm vinylgolv ska läggas?',
      complexity: 'Raka rum eller komplicerad layout?',
      accessibility: 'Vilken våning?',
      qualityLevel: 'Budget-, standard- eller premiumvinyl?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Golvbranschen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'laminatgolv',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.5, normal: 0.7, complex: 1.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.25 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.4,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standardlaminat 100-200 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Mellanklaslaminat 200-350 kr/kvm'] },
      premium: { priceMultiplier: 1.5, examples: ['Premiumlaminat 350+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 280, maxPerUnit: 900, totalMin: 4000, totalMax: 80000 },
    standardWorkItems: [
      { name: 'Förberedelse underlag', mandatory: true, typicalHours: 0.2 },
      { name: 'Läggning laminat', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm laminat ska läggas?',
      complexity: 'Raka rum eller komplicerad layout?',
      accessibility: 'Vilken våning?',
      qualityLevel: 'Budget-, standard- eller premiumlaminat?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Golvbranschen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'slipning_parkettgolv',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.4, normal: 0.6, complex: 0.9 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 550, max: 700 },
    materialRatio: 0.15,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Standardlack'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetslack'] },
      premium: { priceMultiplier: 1.3, examples: ['Premiumlack, miljömärkt'] }
    },
    priceBounds: { minPerUnit: 200, maxPerUnit: 600, totalMin: 5000, totalMax: 60000 },
    standardWorkItems: [
      { name: 'Slipning', mandatory: true, typicalHours: 0.4 },
      { name: 'Lackning', mandatory: true, typicalHours: 0.2 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm parkettgolv ska slipas?',
      complexity: 'Lätt slitage eller djupa repor?',
      accessibility: 'Möbler som ska flyttas?',
      qualityLevel: 'Standard- eller premiumlack?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Golvbranschen 2025)',
    lastUpdated: '2025-11-04'
  },

  // EL
  {
    jobType: 'el_omläggning',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 1.5, normal: 2.5, complex: 4.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 650, typical: 850, max: 1100 },
    materialRatio: 0.35,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Standardkablar och uttag'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetskablar och uttag'] },
      premium: { priceMultiplier: 1.4, examples: ['Premiumkablar och designuttag'] }
    },
    priceBounds: { minPerUnit: 1500, maxPerUnit: 5000, totalMin: 15000, totalMax: 300000 },
    standardWorkItems: [
      { name: 'Rivning gammal el', mandatory: true, typicalHours: 0.8 },
      { name: 'Dragning nya kablar', mandatory: true, typicalHours: 1.5 },
      { name: 'Installation uttag/strömbrytare', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm behöver el-omläggning?',
      complexity: 'Partiell uppdatering eller total omläggning?',
      accessibility: 'Öppna väggar eller behöver öppnas?',
      qualityLevel: 'Standard- eller premiumuttag?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Elföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'el_installation_uttag',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 1.5, normal: 2.5, complex: 4.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 650, typical: 850, max: 1100 },
    materialRatio: 0.2,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Standarduttag 50-100 kr/st'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsuttag 100-200 kr/st'] },
      premium: { priceMultiplier: 1.5, examples: ['Designuttag 200+ kr/st'] }
    },
    priceBounds: { minPerUnit: 1500, maxPerUnit: 5000, totalMin: 1500, totalMax: 50000 },
    standardWorkItems: [
      { name: 'Dragning kabel', mandatory: true, typicalHours: 1.5 },
      { name: 'Installation uttag', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    questionTemplates: {
      unitQty: 'Hur många uttag ska installeras?',
      complexity: 'Nära elcentral eller långt bort?',
      accessibility: 'Öppna väggar eller behöver öppnas?',
      qualityLevel: 'Standard- eller designuttag?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Elföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'el_installation_belysning',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 1.0, normal: 1.5, complex: 2.5 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 650, typical: 850, max: 1100 },
    materialRatio: 0.25,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Enkla armaturer'] },
      standard: { priceMultiplier: 1.0, examples: ['Standardarmaturer'] },
      premium: { priceMultiplier: 1.6, examples: ['Designarmaturer'] }
    },
    priceBounds: { minPerUnit: 1000, maxPerUnit: 3500, totalMin: 1000, totalMax: 100000 },
    standardWorkItems: [
      { name: 'Dragning kabel', mandatory: true, typicalHours: 0.8 },
      { name: 'Installation armatur', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    questionTemplates: {
      unitQty: 'Hur många armaturer ska installeras?',
      complexity: 'Takarmaturer eller infällda spots?',
      accessibility: 'Normal takhöjd eller högre tak?',
      qualityLevel: 'Standard- eller designarmaturer?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Elföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'el_byte_elcentral',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 8, normal: 12, complex: 18 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 650, typical: 850, max: 1100 },
    materialRatio: 0.4,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Standardcentral 3000-5000 kr'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetscentral 5000-8000 kr'] },
      premium: { priceMultiplier: 1.5, examples: ['Premiumcentral 8000+ kr'] }
    },
    priceBounds: { minPerUnit: 12000, maxPerUnit: 30000, totalMin: 12000, totalMax: 30000 },
    standardWorkItems: [
      { name: 'Demontering gammal central', mandatory: true, typicalHours: 2 },
      { name: 'Installation ny central', mandatory: true, typicalHours: 8 },
      { name: 'Testkörning', mandatory: true, typicalHours: 1 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många elcentraler ska bytas?',
      complexity: 'Standard villa eller komplicerad installation?',
      accessibility: 'Var sitter centralen?',
      qualityLevel: 'Standard- eller premiumcentral?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Elföretagen 2025)',
    lastUpdated: '2025-11-04'
  },

  // VVS
  {
    jobType: 'vvs_byte_rör',
    category: 'rot',
    unitType: 'lm',
    timePerUnit: { simple: 1.5, normal: 2.5, complex: 4.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.25, hard: 1.6 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.3 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 700, typical: 900, max: 1200 },
    materialRatio: 0.35,
    materialBuckets: {
      budget: { priceMultiplier: 0.75, examples: ['Standardrör'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsrör'] },
      premium: { priceMultiplier: 1.4, examples: ['Premiumrör'] }
    },
    priceBounds: { minPerUnit: 1500, maxPerUnit: 5000, totalMin: 10000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Rivning gamla rör', mandatory: true, typicalHours: 0.8 },
      { name: 'Installation nya rör', mandatory: true, typicalHours: 1.5 },
      { name: 'Trycktestning', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många löpmeter rör ska bytas?',
      complexity: 'Synliga rör eller i väggar?',
      accessibility: 'Lätt åtkomst eller svårt?',
      qualityLevel: 'Standard- eller premiumrör?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (VVS-företagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'vvs_installation_radiator',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 3, normal: 5, complex: 8 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.5 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 700, typical: 900, max: 1200 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.6, examples: ['Standardradiator 1500-3000 kr'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsradiator 3000-5000 kr'] },
      premium: { priceMultiplier: 1.8, examples: ['Designradiator 5000+ kr'] }
    },
    priceBounds: { minPerUnit: 4000, maxPerUnit: 15000, totalMin: 4000, totalMax: 150000 },
    standardWorkItems: [
      { name: 'Demontering gammal radiator', mandatory: true, typicalHours: 1 },
      { name: 'Installation ny radiator', mandatory: true, typicalHours: 3 },
      { name: 'Trycktestning', mandatory: true, typicalHours: 0.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många radiatorer ska installeras?',
      complexity: 'Standard byte eller behöver ny dragning?',
      accessibility: 'Normal placering eller svåråtkomligt?',
      qualityLevel: 'Standard- eller designradiator?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (VVS-företagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'vvs_byte_kran',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 1, normal: 1.5, complex: 2.5 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.85, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 700, typical: 900, max: 1200 },
    materialRatio: 0.4,
    materialBuckets: {
      budget: { priceMultiplier: 0.6, examples: ['Standardblandare 500-1500 kr'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsblandare 1500-3000 kr'] },
      premium: { priceMultiplier: 1.8, examples: ['Designblandare 3000+ kr'] }
    },
    priceBounds: { minPerUnit: 1500, maxPerUnit: 5000, totalMin: 1500, totalMax: 50000 },
    standardWorkItems: [
      { name: 'Demontering gammal kran', mandatory: true, typicalHours: 0.3 },
      { name: 'Installation ny kran', mandatory: true, typicalHours: 1.0 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    questionTemplates: {
      unitQty: 'Hur många kranar ska bytas?',
      complexity: 'Enkel byte eller behöver nya anslutningar?',
      accessibility: 'Normal installation eller svårt?',
      qualityLevel: 'Standard- eller designblandare?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (VVS-företagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'vvs_byte_toalett',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 2, normal: 3, complex: 5 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.5 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 700, typical: 900, max: 1200 },
    materialRatio: 0.4,
    materialBuckets: {
      budget: { priceMultiplier: 0.6, examples: ['Standardtoalett 1500-3000 kr'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetstoalett 3000-6000 kr'] },
      premium: { priceMultiplier: 1.7, examples: ['Designtoalett 6000+ kr'] }
    },
    priceBounds: { minPerUnit: 3500, maxPerUnit: 12000, totalMin: 3500, totalMax: 50000 },
    standardWorkItems: [
      { name: 'Demontering gammal toalett', mandatory: true, typicalHours: 0.8 },
      { name: 'Installation ny toalett', mandatory: true, typicalHours: 2.0 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    questionTemplates: {
      unitQty: 'Hur många toaletter ska bytas?',
      complexity: 'Standard byte eller behöver ny dragning?',
      accessibility: 'Normal installation eller trångt?',
      qualityLevel: 'Standard- eller designtoalett?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (VVS-företagen 2025)',
    lastUpdated: '2025-11-04'
  },

  // FÖNSTER & DÖRRAR
  {
    jobType: 'byte_fönster',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 3, normal: 5, complex: 8 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.75, standard: 1.0, premium: 1.6 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 550, typical: 700, max: 900 },
    materialRatio: 0.6,
    materialBuckets: {
      budget: { priceMultiplier: 0.6, examples: ['Standardfönster 3000-6000 kr/st'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsfönster 6000-12000 kr/st'] },
      premium: { priceMultiplier: 1.8, examples: ['Premiumfönster 12000+ kr/st'] }
    },
    priceBounds: { minPerUnit: 5000, maxPerUnit: 25000, totalMin: 5000, totalMax: 500000 },
    standardWorkItems: [
      { name: 'Demontering gammalt fönster', mandatory: true, typicalHours: 1.5 },
      { name: 'Installation nytt fönster', mandatory: true, typicalHours: 3.0 },
      { name: 'Tätning och finish', mandatory: true, typicalHours: 1.0 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många fönster ska bytas?',
      complexity: 'Standard storlek eller specialfönster?',
      accessibility: 'Vilken våning? Behövs lift?',
      qualityLevel: 'Budget-, standard- eller premiumfönster?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'byte_dörr_ytterdörr',
    category: 'rot',
    unitType: 'st',
    timePerUnit: { simple: 4, normal: 6, complex: 10 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.75, standard: 1.0, premium: 1.7 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 600, typical: 750, max: 950 },
    materialRatio: 0.65,
    materialBuckets: {
      budget: { priceMultiplier: 0.6, examples: ['Standardytterdörr 5000-10000 kr'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsytterdörr 10000-20000 kr'] },
      premium: { priceMultiplier: 1.9, examples: ['Säkerhetsytterdörr 20000+ kr'] }
    },
    priceBounds: { minPerUnit: 10000, maxPerUnit: 40000, totalMin: 10000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Demontering gammal dörr', mandatory: true, typicalHours: 1.5 },
      { name: 'Installation ny dörr', mandatory: true, typicalHours: 4.0 },
      { name: 'Justering och tätning', mandatory: true, typicalHours: 1.0 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många ytterdörrar ska bytas?',
      complexity: 'Standard storlek eller specialdörr?',
      accessibility: 'Normal installation eller komplicerat?',
      qualityLevel: 'Standard-, kvalitets- eller säkerhetsdörr?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'byte_dörr_invändig',
    category: 'rut',
    unitType: 'st',
    timePerUnit: { simple: 1.5, normal: 2.5, complex: 4.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.25 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.5 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 500, typical: 650, max: 850 },
    materialRatio: 0.55,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standarddörr 1000-2500 kr'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsdörr 2500-5000 kr'] },
      premium: { priceMultiplier: 1.7, examples: ['Designdörr 5000+ kr'] }
    },
    priceBounds: { minPerUnit: 2000, maxPerUnit: 10000, totalMin: 2000, totalMax: 100000 },
    standardWorkItems: [
      { name: 'Demontering gammal dörr', mandatory: true, typicalHours: 0.5 },
      { name: 'Installation ny dörr', mandatory: true, typicalHours: 1.5 },
      { name: 'Justering', mandatory: true, typicalHours: 0.3 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många invändiga dörrar ska bytas?',
      complexity: 'Standard eller specialstorlek?',
      accessibility: 'Lätt åtkomst?',
      qualityLevel: 'Standard- eller designdörr?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Byggfakta 2025)',
    lastUpdated: '2025-11-04'
  },

  // TAK
  {
    jobType: 'takläggning_plåt',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 1.5, normal: 2.5, complex: 4.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.25, hard: 1.6 },
      quality: { budget: 0.8, standard: 1.0, premium: 1.4 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.4 }
    },
    hourlyRateRange: { min: 600, typical: 800, max: 1050 },
    materialRatio: 0.45,
    materialBuckets: {
      budget: { priceMultiplier: 0.7, examples: ['Standardplåt 150-250 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsplåt 250-400 kr/kvm'] },
      premium: { priceMultiplier: 1.5, examples: ['Premiumplåt 400+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 1200, maxPerUnit: 5000, totalMin: 50000, totalMax: 500000 },
    standardWorkItems: [
      { name: 'Rivning gammalt tak', mandatory: false, typicalHours: 0.8 },
      { name: 'Läggning nytt plåttak', mandatory: true, typicalHours: 2.0 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm tak ska läggas?',
      complexity: 'Enkelt sadeltak eller komplicerat?',
      accessibility: 'Takhöjd? Stigningshastighet?',
      qualityLevel: 'Standard- eller premiumplåt?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Takläggare 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'takläggning_tegel',
    category: 'rot',
    unitType: 'kvm',
    timePerUnit: { simple: 2.5, normal: 4.0, complex: 6.0 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.25, hard: 1.6 },
      quality: { budget: 0.75, standard: 1.0, premium: 1.6 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.5 }
    },
    hourlyRateRange: { min: 600, typical: 800, max: 1050 },
    materialRatio: 0.5,
    materialBuckets: {
      budget: { priceMultiplier: 0.65, examples: ['Standardtegel 250-400 kr/kvm'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetstegel 400-650 kr/kvm'] },
      premium: { priceMultiplier: 1.7, examples: ['Premiumtegel 650+ kr/kvm'] }
    },
    priceBounds: { minPerUnit: 2000, maxPerUnit: 7000, totalMin: 80000, totalMax: 700000 },
    standardWorkItems: [
      { name: 'Rivning gammalt tak', mandatory: false, typicalHours: 1.5 },
      { name: 'Läggning tegelpannor', mandatory: true, typicalHours: 3.5 }
    ],
    applicableDeduction: 'rot',
    deductionPercentage: 30,
    serviceVehicle: { threshold: 4, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många kvm tegeltak ska läggas?',
      complexity: 'Enkelt eller komplicerat tak?',
      accessibility: 'Takhöjd? Stigningshastighet?',
      qualityLevel: 'Standard- eller premiumtegel?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Takläggare 2025)',
    lastUpdated: '2025-11-04'
  },

  // TRÄDGÅRD (varianter)
  {
    jobType: 'gräsklippning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.05, normal: 0.08, complex: 0.12 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 350, typical: 450, max: 600 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 0.9, examples: ['Standard gräsklippning'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsklippning med kant'] },
      premium: { priceMultiplier: 1.3, examples: ['Premium med multch och kant'] }
    },
    priceBounds: { minPerUnit: 15, maxPerUnit: 70, totalMin: 500, totalMax: 20000 },
    standardWorkItems: [
      { name: 'Klippning', mandatory: true, typicalHours: 0.08 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm gräsmatta?',
      complexity: 'Öppen yta eller många hinder?',
      accessibility: 'Backe eller plan mark?',
      qualityLevel: 'Standard- eller premium med kant?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'häcklippning',
    category: 'rut',
    unitType: 'lm',
    timePerUnit: { simple: 0.15, normal: 0.25, complex: 0.4 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.4 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 350, typical: 450, max: 600 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 0.9, examples: ['Standard häcklippning'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsklippning med formning'] },
      premium: { priceMultiplier: 1.3, examples: ['Premium med toppformning'] }
    },
    priceBounds: { minPerUnit: 50, maxPerUnit: 250, totalMin: 500, totalMax: 30000 },
    standardWorkItems: [
      { name: 'Klippning häck', mandatory: true, typicalHours: 0.25 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många löpmeter häck?',
      complexity: 'Normal höjd eller hög häck?',
      accessibility: 'Lätt åtkomst?',
      qualityLevel: 'Standard eller formklippt?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'trädfällning',
    category: 'rut',
    unitType: 'st',
    timePerUnit: { simple: 2, normal: 4, complex: 8 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.3, hard: 1.7 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.7, normal: 1.0, complex: 1.6 }
    },
    hourlyRateRange: { min: 600, typical: 800, max: 1100 },
    materialRatio: 0.1,
    materialBuckets: {
      budget: { priceMultiplier: 0.85, examples: ['Enkel fällning'] },
      standard: { priceMultiplier: 1.0, examples: ['Standard med stubbfräsning'] },
      premium: { priceMultiplier: 1.4, examples: ['Premium med trädvård'] }
    },
    priceBounds: { minPerUnit: 2000, maxPerUnit: 20000, totalMin: 2000, totalMax: 200000 },
    standardWorkItems: [
      { name: 'Trädfällning', mandatory: true, typicalHours: 3 },
      { name: 'Stubbfräsning', mandatory: false, typicalHours: 1 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    serviceVehicle: { threshold: 2, autoInclude: true, unit: 'dag' },
    questionTemplates: {
      unitQty: 'Hur många träd ska fällas?',
      complexity: 'Små/medelstora eller stora träd?',
      accessibility: 'Fri fällningsriktning eller trångt?',
      qualityLevel: 'Bara fällning eller med stubbfräsning?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'snöröjning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.03, normal: 0.05, complex: 0.08 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.15, hard: 1.35 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.8, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 700 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 0.9, examples: ['Standard snöröjning'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsröjning med sand'] },
      premium: { priceMultiplier: 1.3, examples: ['Premium med halkbekämpning'] }
    },
    priceBounds: { minPerUnit: 10, maxPerUnit: 50, totalMin: 300, totalMax: 15000 },
    standardWorkItems: [
      { name: 'Snöröjning', mandatory: true, typicalHours: 0.05 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm ska röjas?',
      complexity: 'Öppen yta eller komplicerad?',
      accessibility: 'Kan plog användas?',
      qualityLevel: 'Bara röjning eller med sand/salt?'
    },
    regionSensitive: true,
    seasonSensitive: true,
    source: 'Webben (Trädgårdsföretagen 2025)',
    lastUpdated: '2025-11-04'
  },

  // STÄDNING (varianter)
  {
    jobType: 'storstädning',
    category: 'rut',
    unitType: 'kvm',
    timePerUnit: { simple: 0.2, normal: 0.25, complex: 0.35 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.1, hard: 1.3 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.25 }
    },
    hourlyRateRange: { min: 350, typical: 450, max: 550 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 0.8, examples: ['Standardmedel'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsmedel'] },
      premium: { priceMultiplier: 1.3, examples: ['Miljömärkta premiummedel'] }
    },
    priceBounds: { minPerUnit: 70, maxPerUnit: 180, totalMin: 2500, totalMax: 20000 },
    standardWorkItems: [
      { name: 'Grundlig städning', mandatory: true, typicalHours: 0.25 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många kvm ska städas?',
      complexity: 'Tomt eller mycket möblerat?',
      accessibility: 'Våning? Hiss?',
      qualityLevel: 'Standard eller premium?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Hemfrid 2025)',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'fönsterputsning',
    category: 'rut',
    unitType: 'st',
    timePerUnit: { simple: 0.15, normal: 0.25, complex: 0.4 },
    multipliers: {
      accessibility: { easy: 1.0, normal: 1.2, hard: 1.5 },
      quality: { budget: 0.9, standard: 1.0, premium: 1.2 },
      complexity: { simple: 0.85, normal: 1.0, complex: 1.3 }
    },
    hourlyRateRange: { min: 400, typical: 500, max: 650 },
    materialRatio: 0.05,
    materialBuckets: {
      budget: { priceMultiplier: 0.9, examples: ['Standard fönsterputs'] },
      standard: { priceMultiplier: 1.0, examples: ['Kvalitetsputs med karmputs'] },
      premium: { priceMultiplier: 1.3, examples: ['Premium med impregnering'] }
    },
    priceBounds: { minPerUnit: 60, maxPerUnit: 250, totalMin: 500, totalMax: 30000 },
    standardWorkItems: [
      { name: 'Fönsterputs', mandatory: true, typicalHours: 0.25 }
    ],
    applicableDeduction: 'rut',
    deductionPercentage: 50,
    questionTemplates: {
      unitQty: 'Hur många fönster ska putsas?',
      complexity: 'Normala fönster eller stora/svåra?',
      accessibility: 'Markplan eller högt upp?',
      qualityLevel: 'Standard eller premium med karm?'
    },
    regionSensitive: true,
    seasonSensitive: false,
    source: 'Webben (Fönsterputsarna 2025)',
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
