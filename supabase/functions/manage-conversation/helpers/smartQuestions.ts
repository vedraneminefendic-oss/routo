// ============================================================================
// SMART QUESTIONS - FAS 3: Batch-frågor och synonym-mapping
// ============================================================================

export interface ProjectRequirements {
  projectType: string;
  mandatoryQuestions: string[];
  optionalQuestions: string[];
  assumptions: string[];
}

// ============================================================================
// FAS 16: AI-DRIVEN SMART QUESTIONS
// Simplified version - all projects now use AI-generated questions
// ============================================================================

// Simplified: All projects now use AI-driven questioning
// FAS 23: Enhanced prompt guidelines for breadth over depth
export const QUESTION_STRATEGY_GUIDELINES = `
**FAS 23: QUESTION QUALITY & BREADTH CONTROL**

CRITICAL RULES:
1. Max 3-4 frågor per runda (ALDRIG mer)
2. PRIORITERA BREDD över DJUP - täck olika kategorier, inte detaljer inom samma
3. UNDVIK detaljfrågor om färg, exakt materialtjocklek, specifika märken SÅVIDA användaren inte nämnt det först
4. En kategori = max 1 fråga

EXEMPEL PÅ BRA FRÅGOR (bredd):
✅ "Hur stor är arean?" (scope)
✅ "Ska material ingå?" (scope) 
✅ "Finns det en tidsram?" (timeline)

EXEMPEL PÅ DÅLIGA FRÅGOR (djup):
❌ "Vilken nyans av vit färg?" (för specifikt)
❌ "Vilken tjocklek på kaklet?" (för detaljerat)
❌ "Vilket märke på spackel?" (onödigt, såvida inte nämnt)

STRATEGI:
- Runda 1: Fråga om OLIKA saknade kategorier (scope, size, materials, timeline)
- Runda 2: Förfina ENDAST det mest kritiska
- Efter 3 frågor → GENERERA DRAFT (med prisintervall för oklarheter)
`;

export function getProjectRequirements(description: string): ProjectRequirements {
  return { 
    projectType: 'ai_driven', 
    mandatoryQuestions: [], 
    optionalQuestions: [], 
    assumptions: [] 
  };
}

// Legacy batch questions - kept for backward compatibility but not used in AI-driven mode
export function generateBatchQuestions(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[],
  maxQuestions: number = 6
): string[] {
  return []; // Not used in AI-driven mode
}

// Legacy single-question mode (fallback)
export function generateNextQuestion(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[]
): string | null {
  return null; // Not used in AI-driven mode
}
