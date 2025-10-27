// ============================================================================
// PROJECT STANDARDS - Generic Industry Standards (AI-Driven)
// ============================================================================
// FAS 17: Minifierad version - Hårdkodade projekttyper ersatta med AI-driven
// dynamisk generering. AI genererar mandatoryWorkItems baserat på:
// - Projekttyp (från conversation summary)
// - Branschkunskap (från AI:ns träning)
// - Liknande tidigare offerter
// - Användarens tidigare mönster

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
// GENERIC INDUSTRY STANDARDS - Används som fallback/guidance
// ============================================================================
// AI använder dessa som referens för rimliga timpriser per bransch

interface GenericStandard {
  category: string;
  minHourlyRate: number;
  maxHourlyRate: number;
  description: string;
}

export const GENERIC_STANDARDS: GenericStandard[] = [
  { category: 'construction', minHourlyRate: 750, maxHourlyRate: 950, description: 'Allmän byggverksamhet, snickeri, rivning' },
  { category: 'electrical', minHourlyRate: 900, maxHourlyRate: 1100, description: 'Elinstallationer, certifiering' },
  { category: 'plumbing', minHourlyRate: 900, maxHourlyRate: 1100, description: 'VVS-arbeten, rörinstallationer' },
  { category: 'painting', minHourlyRate: 600, maxHourlyRate: 800, description: 'Målning, spackling, slipning' },
  { category: 'gardening', minHourlyRate: 500, maxHourlyRate: 750, description: 'Trädgårdsarbete, beskärning' },
  { category: 'cleaning', minHourlyRate: 450, maxHourlyRate: 600, description: 'Städning, hemservice' },
  { category: 'flooring', minHourlyRate: 700, maxHourlyRate: 900, description: 'Golvläggning, parkett, kakel' },
  { category: 'roofing', minHourlyRate: 800, maxHourlyRate: 1000, description: 'Takarbeten, plåtslageri' },
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

// ============================================
// PROJECT TYPE DETECTION - AI-DRIVEN
// ============================================

export function detectProjectType(description: string): ProjectStandard | null {
  // FAS 17: Returnera alltid ai_driven - AI hanterar allt dynamiskt
  console.log('🤖 FAS 17: AI-driven project detection enabled');
  return PROJECT_STANDARDS[0]; // ai_driven fallback
}

// ============================================
// GENERATE PROMPT ADDITION - SIMPLIFIED
// ============================================

export function getProjectPromptAddition(standard: ProjectStandard, area?: number): string {
  // FAS 17: Simplified - AI genererar allt dynamiskt baserat på GENERIC_STANDARDS
  if (standard.projectType === 'ai_driven') {
    const genericRates = GENERIC_STANDARDS.map(s => 
      `- ${s.category}: ${s.minHourlyRate}-${s.maxHourlyRate} kr/h (${s.description})`
    ).join('\n');

    return `
**BRANSCHREFERENSER (GENERISKA):**
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

  // Legacy fallback (bör aldrig nås)
  return '';
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
