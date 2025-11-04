// ============================================================================
// PROJECT STANDARDS - FAS 5: Smart Project Detection with Fallback Hierarchy
// ============================================================================
// FAS 5: Förbättrad projektdetektering med tre-nivå fallback:
// Level 1: Specifik projekttyp (badrum, kök, målning, fasad, trädgård, parkett)
// Level 2: Kategori-matchning (byggverksamhet, el, vvs, städning, etc.)
// Level 3: Generisk AI-driven detektering
//
// Detta ger:
// - Bättre precision för vanliga projekt
// - Korrekt formula engine routing
// - Tydlig fallback när projekt är oklart

export interface WorkItem {
  name: string;
  minHours: number;
  maxHours: number;
  hourlyRate: number; // SEK/timme
  description: string;
  mandatory: boolean;
}

export interface Material {
  name: string;
  minCost?: number;
  maxCost?: number;
  unit?: string; // kvm, st, m, etc
}

export interface ProjectStandard {
  projectType: string;
  displayName: string;
  keywords: string[];
  mandatoryWorkItems: WorkItem[];
  optionalWorkItems: WorkItem[];
  mandatoryMaterials: Material[];
  minCostPerSqm?: number;
  maxCostPerSqm?: number;
  minCostFlat?: number;
  maxCostFlat?: number;
  warnings: string[];
  assumptions: string[];
}

// PROJECT INTENT
export interface ProjectIntent {
  scope: 'total' | 'partial' | 'new' | 'unknown';
  urgency: 'urgent' | 'normal' | 'flexible';
  quality: 'budget' | 'standard' | 'premium';
  explicitInclusions: string[];
  explicitExclusions: string[];
  specialRequirements: string[];
}

// Detect scope helper
export function detectScope(description: string): 'total' | 'partial' | 'new' | 'unknown' {
  const lower = description.toLowerCase();
  const totalKeywords = ['totalrenovering', 'total renovering', 'hel renovering', 'komplett renovering'];
  const partialKeywords = ['delrenovering', 'upprustning', 'uppfräschning'];
  
  if (totalKeywords.some(kw => lower.includes(kw))) return 'total';
  if (partialKeywords.some(kw => lower.includes(kw))) return 'partial';
  return 'unknown';
}

// Detect project intent
export function detectProjectIntent(description: string, conversation: string[]): ProjectIntent {
  const combined = (description + ' ' + conversation.join(' ')).toLowerCase();
  
  return {
    scope: detectScope(combined),
    urgency: 'normal',
    quality: 'standard',
    explicitInclusions: [],
    explicitExclusions: [],
    specialRequirements: []
  };
}

// ============================================================================
// FAS 5: DETECTION LEVELS - Three-tier fallback hierarchy
// ============================================================================

export type DetectionLevel = 'specific' | 'category' | 'generic';

export interface DetectionResult {
  level: DetectionLevel;
  projectType: string;
  category: string;
  confidence: number; // 0-1
  matchedKeywords: readonly string[];
  suggestedMoments?: readonly string[]; // För Formula Engine routing
}

// ============================================================================
// LEVEL 1: SPECIFIC PROJECT TYPES (Formula Engine routing)
// ============================================================================
// Dessa har dedikerade moment i Formula Engine och måste detekteras exakt

export const SPECIFIC_PROJECT_TYPES = {
  badrum: {
    keywords: ['badrum', 'våtrum', 'dusch', 'toalett', 'wc', 'badrummet', 'badrumsrenovering'],
    category: 'construction',
    moments: ['rivning_badrum', 'vvs_badrum', 'el_badrum', 'vattenisol_badrum', 'kakel_badrum'],
    hourlyRateRange: [750, 950]
  },
  kok: {
    keywords: ['kök', 'kokyta', 'köksutrymme', 'köksrenovering', 'köket'],
    category: 'construction',
    moments: ['rivning_kok', 'vvs_kok', 'el_kok', 'kakel_kok', 'skåp_montering'],
    hourlyRateRange: [750, 950]
  },
  malning: {
    keywords: ['måla', 'målning', 'måla om', 'färga', 'lacka', 'målarfärg', 'väggfärg'],
    category: 'painting',
    moments: ['spackling_sliping', 'grundning', 'malning_1_lager', 'malning_2_lager'],
    hourlyRateRange: [600, 800]
  },
  fasad: {
    keywords: ['fasad', 'fasadmålning', 'puts', 'utvändig målning', 'fasadputsning'],
    category: 'construction',
    moments: ['fasad_rengoring', 'fasad_forberedelse', 'fasad_malning', 'stallning'],
    hourlyRateRange: [700, 900]
  },
  tradgard: {
    keywords: ['trädgård', 'trädgårdsarbete', 'gräsklippning', 'häckklippning', 'beskärning', 'trädfällning', 'fälla träd'],
    category: 'gardening',
    moments: ['markberedning', 'plantering', 'grasklippning', 'hakkklippning', 'tradfallning'],
    hourlyRateRange: [500, 750]
  },
  parkett: {
    keywords: ['parkett', 'parkettläggning', 'trägolv', 'slipning', 'lackering', 'golvslipning'],
    category: 'flooring',
    moments: ['underlagsarbete', 'parkett_laggning', 'slipning', 'lackering'],
    hourlyRateRange: [700, 900]
  }
} as const;

export type SpecificProjectType = keyof typeof SPECIFIC_PROJECT_TYPES;

// ============================================================================
// LEVEL 2: CATEGORY STANDARDS (Generic guidance)
// ============================================================================

interface GenericStandard {
  category: string;
  minHourlyRate: number;
  maxHourlyRate: number;
  description: string;
  keywords: string[];
}

export const GENERIC_STANDARDS: GenericStandard[] = [
  { 
    category: 'construction', 
    minHourlyRate: 750, 
    maxHourlyRate: 950, 
    description: 'Allmän byggverksamhet, snickeri, rivning',
    keywords: ['bygga', 'renovera', 'snickare', 'rivning', 'byggarbete', 'ombyggnad', 'tillbyggnad']
  },
  { 
    category: 'electrical', 
    minHourlyRate: 900, 
    maxHourlyRate: 1100, 
    description: 'Elinstallationer, certifiering',
    keywords: ['el', 'elinstallation', 'uttag', 'belysning', 'elmätare', 'elektriker']
  },
  { 
    category: 'plumbing', 
    minHourlyRate: 900, 
    maxHourlyRate: 1100, 
    description: 'VVS-arbeten, rörinstallationer',
    keywords: ['vvs', 'rör', 'avlopp', 'vatten', 'rörmokare', 'ledning', 'kranar']
  },
  { 
    category: 'painting', 
    minHourlyRate: 600, 
    maxHourlyRate: 800, 
    description: 'Målning, spackling, slipning',
    keywords: ['måla', 'målning', 'spackling', 'slipning', 'målare', 'tapetsering']
  },
  { 
    category: 'gardening', 
    minHourlyRate: 500, 
    maxHourlyRate: 750, 
    description: 'Trädgårdsarbete, beskärning',
    keywords: ['trädgård', 'gräs', 'häck', 'plantera', 'träd', 'buskar', 'trädgårdsarbete']
  },
  { 
    category: 'cleaning', 
    minHourlyRate: 450, 
    maxHourlyRate: 600, 
    description: 'Städning, hemservice',
    keywords: ['städ', 'städning', 'rengöring', 'flyttstäd', 'storstädning', 'hemstädning']
  },
  { 
    category: 'flooring', 
    minHourlyRate: 700, 
    maxHourlyRate: 900, 
    description: 'Golvläggning, parkett, kakel',
    keywords: ['golv', 'parkett', 'klinker', 'matta', 'vinyl', 'golvläggning', 'kakel']
  },
  { 
    category: 'roofing', 
    minHourlyRate: 800, 
    maxHourlyRate: 1000, 
    description: 'Takarbeten, plåtslageri',
    keywords: ['tak', 'takläggning', 'plåt', 'takpannor', 'takrenovering', 'takplåt']
  },
];

// ============================================================================
// AI-DRIVEN PROJECT DETECTION
// ============================================================================
// Istället för 15 hårdkodade projekttyper, returnerar vi bara 'ai_driven'
// och låter AI:n i generate-quote hantera allt dynamiskt

export const PROJECT_STANDARDS: ProjectStandard[] = [
  // AI-DRIVEN: Generisk projektstandard som används som fallback
  {
    projectType: 'ai_driven',
    displayName: 'AI-Driven Project',
    keywords: [], // AI detekterar projekttyp dynamiskt
    mandatoryWorkItems: [], // AI genererar dynamiskt
    optionalWorkItems: [],
    mandatoryMaterials: [],
    warnings: [],
    assumptions: ['AI genererar projektdetaljer baserat på beskrivning och branschkunskap']
  }
];

// ============================================================================
// FAS 5: SMART PROJECT DETECTION - Three-tier fallback hierarchy
// ============================================================================

export function detectProjectTypeAdvanced(description: string, conversationHistory?: string[]): DetectionResult {
  const normalized = description.toLowerCase();
  const fullContext = conversationHistory 
    ? (description + ' ' + conversationHistory.join(' ')).toLowerCase()
    : normalized;

  // LEVEL 1: SPECIFIC PROJECT TYPE DETECTION
  for (const [projectType, config] of Object.entries(SPECIFIC_PROJECT_TYPES)) {
    const matchedKeywords = config.keywords.filter(kw => fullContext.includes(kw));
    
    if (matchedKeywords.length > 0) {
      const confidence = Math.min(0.95, 0.6 + (matchedKeywords.length * 0.15));
      
      console.log(`✅ FAS 5 Level 1: Detected specific project type '${projectType}' (confidence: ${(confidence * 100).toFixed(0)}%)`);
      
      return {
        level: 'specific',
        projectType,
        category: config.category,
        confidence,
        matchedKeywords,
        suggestedMoments: config.moments
      };
    }
  }

  // LEVEL 2: CATEGORY DETECTION
  for (const standard of GENERIC_STANDARDS) {
    const matchedKeywords = standard.keywords.filter(kw => fullContext.includes(kw));
    
    if (matchedKeywords.length > 0) {
      const confidence = Math.min(0.75, 0.4 + (matchedKeywords.length * 0.15));
      
      console.log(`⚠️ FAS 5 Level 2: Detected category '${standard.category}' (confidence: ${(confidence * 100).toFixed(0)}%)`);
      
      return {
        level: 'category',
        projectType: standard.category,
        category: standard.category,
        confidence,
        matchedKeywords,
        suggestedMoments: undefined
      };
    }
  }

  // LEVEL 3: GENERIC AI-DRIVEN FALLBACK
  console.log('🤖 FAS 5 Level 3: Using generic AI-driven detection (no specific match)');
  
  return {
    level: 'generic',
    projectType: 'ai_driven',
    category: 'construction', // Default till construction
    confidence: 0.3,
    matchedKeywords: [],
    suggestedMoments: undefined
  };
}

// Legacy function - behålls för backward compatibility
export function detectProjectType(description: string): ProjectStandard | null {
  const result = detectProjectTypeAdvanced(description);
  
  // Return legacy ProjectStandard format
  if (result.level === 'specific') {
    const config = SPECIFIC_PROJECT_TYPES[result.projectType as SpecificProjectType];
    return {
      projectType: result.projectType,
      displayName: result.projectType.charAt(0).toUpperCase() + result.projectType.slice(1),
      keywords: [...config.keywords], // Convert readonly to mutable
      mandatoryWorkItems: [],
      optionalWorkItems: [],
      mandatoryMaterials: [],
      warnings: [],
      assumptions: []
    };
  }
  
  // For category or generic, return ai_driven fallback
  return PROJECT_STANDARDS[0];
}

// ============================================================================
// FAS 5: GENERATE PROMPT ADDITION - Level-aware guidance
// ============================================================================

export function getProjectPromptAddition(
  standard: ProjectStandard, 
  area?: number,
  detectionResult?: DetectionResult
): string {
  // FAS 5: Use detection level to provide appropriate guidance
  
  if (detectionResult?.level === 'specific') {
    const config = SPECIFIC_PROJECT_TYPES[detectionResult.projectType as SpecificProjectType];
    const [minRate, maxRate] = config.hourlyRateRange;
    
    return `
**FAS 5 LEVEL 1: SPECIFIK PROJEKTTYP DETEKTERAD**
Projekttyp: ${detectionResult.projectType}
Konfidensgrad: ${(detectionResult.confidence * 100).toFixed(0)}%
Matchade nyckelord: ${detectionResult.matchedKeywords.join(', ')}

**MOMENT ATT ANVÄNDA (Formula Engine):**
${config.moments.map(m => `- ${m}`).join('\n')}

**TIMPRIS-GUIDANCE:**
Rekommenderat timpris: ${minRate}-${maxRate} kr/h
Kategori: ${config.category}

**VIKTIGT:**
- ANVÄND Formula Engine för alla moment ovan
- Returnera ENDAST parametrar (ALDRIG timmar direkt)
- Följ moment-specifika standarder
    `.trim();
  }

  if (detectionResult?.level === 'category') {
    const categoryStandard = GENERIC_STANDARDS.find(s => s.category === detectionResult.category);
    if (categoryStandard) {
      return `
**FAS 5 LEVEL 2: KATEGORI DETEKTERAD**
Kategori: ${categoryStandard.category}
Konfidensgrad: ${(detectionResult.confidence * 100).toFixed(0)}%
Matchade nyckelord: ${detectionResult.matchedKeywords.join(', ')}

**TIMPRIS-GUIDANCE:**
Rekommenderat timpris: ${categoryStandard.minHourlyRate}-${categoryStandard.maxHourlyRate} kr/h
Beskrivning: ${categoryStandard.description}

**VIKTIGT:**
- Ingen specifik Formula Engine routing (använd generisk beräkning)
- Returnera ENDAST parametrar om möjligt
- Justera timpris baserat på komplexitet och användarens tidigare priser
      `.trim();
    }
  }

  // FAS 5 LEVEL 3: GENERIC AI-DRIVEN FALLBACK
  const genericRates = GENERIC_STANDARDS.map(s => 
    `- ${s.category}: ${s.minHourlyRate}-${s.maxHourlyRate} kr/h (${s.description})`
  ).join('\n');

  return `
**FAS 5 LEVEL 3: GENERISK AI-DRIVEN DETEKTERING**
Konfidensgrad: Låg (inget specifikt projekt kunde detekteras)

**BRANSCHREFERENSER:**
${genericRates}

**AI-INSTRUKTIONER:**
- Analysera projektbeskrivningen och identifiera projekttyp dynamiskt
- Generera relevanta mandatoryWorkItems baserat på branschkunskap
- Använd generiska timpriser som referens, justera baserat på:
  * Projekttyp och komplexitet
  * Användarens tidigare timpriser (om tillgängliga)
  * Marknadsdata (om tillgänglig)
- Inkludera ENDAST arbeten som är relevanta för detta specifika projekt
- Förklara tydligt vad som ingår och varför
  `.trim();
}

// ============================================
// KEYWORD SYNONYMS - Behålls för backward compatibility
// ============================================

export const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'renovera': ['rusta upp', 'totalrenovera', 'bygga om'],
  'måla': ['måla om', 'målning', 'färga', 'lacka'],
  'färg': ['målarfärg', 'väggfärg', 'takfärg'],
  'kakel': ['klinker', 'plattor', 'keramik'],
  'badrum': ['våtrum', 'dusch', 'toalett'],
  'kök': ['köksutrymme', 'kokyta'],
};

export function normalizeKeyword(word: string): string {
  const lower = word.toLowerCase().trim();
  
  for (const [canonical, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (lower === canonical) return canonical;
    if (synonyms.includes(lower)) return canonical;
  }
  
  return lower;
}
