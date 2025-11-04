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
5. UNDVIK ALLTID frågor om när något ska utföras (timeline, tidsplan, färdigställandedatum)

EXEMPEL PÅ BRA FRÅGOR (bredd):
✅ "Hur stor är arean?" (scope)
✅ "Ska material ingå?" (scope) 

EXEMPEL PÅ DÅLIGA FRÅGOR (djup eller timeline):
❌ "Vilken nyans av vit färg?" (för specifikt)
❌ "Vilken tjocklek på kaklet?" (för detaljerat)
❌ "Vilket märke på spackel?" (onödigt, såvida inte nämnt)
❌ "När ska jobbet vara färdigt?" (timeline - ALDRIG fråga om detta)
❌ "Finns det en tidsram?" (timeline - ALDRIG fråga om detta)

STRATEGI:
- Runda 1: Fråga om OLIKA saknade kategorier (scope, size, materials)
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

// ============================================================================
// FAS 3: UNIVERSAL DIMENSIONS - Works for ALL job types
// ============================================================================

export interface UniversalDimensions {
  scope: {
    key: 'scope';
    question: string;
    examples: string[];
  };
  size: {
    key: 'size';
    question: string;
    examples: string[];
  };
  materials: {
    key: 'materials';
    question: string;
    examples: string[];
  };
  complexity: {
    key: 'complexity';
    question: string;
    examples: string[];
  };
}

// FAS 3: Universal question templates that adapt to any job type
export const UNIVERSAL_DIMENSIONS: UniversalDimensions = {
  scope: {
    key: 'scope',
    question: 'Vad ska göras exakt?',
    examples: [
      'Totalrenovering eller delrenovering?',
      'Nyinstallation eller reparation?',
      'Ska något rivas eller demonteras?',
      'Vad ingår i arbetet?'
    ]
  },
  size: {
    key: 'size',
    question: 'Hur stor är arbetsytan?',
    examples: [
      'Hur många kvadratmeter?',
      'Hur många rum/enheter?',
      'Vilka mått har ytan?',
      'Hur mycket ska göras?'
    ]
  },
  materials: {
    key: 'materials',
    question: 'Vilka material ska användas?',
    examples: [
      'Ska material ingå i offerten?',
      'Vilken kvalitetsnivå? (budget/standard/premium)',
      'Finns det specifika material önskat?',
      'Har du redan köpt material?'
    ]
  },
  complexity: {
    key: 'complexity',
    question: 'Finns det speciella förutsättningar?',
    examples: [
      'Är det något som gör jobbet svårare?',
      'Finns speciella krav eller önskemål?',
      'Behövs förberedelser eller extra arbete?',
      'Några begränsningar att vara medveten om?'
    ]
  }
};

// FAS 3: Get universal questions based on missing dimensions
export function getUniversalQuestions(
  missingDimensions: string[],
  projectType?: string
): string[] {
  const questions: string[] = [];
  
  // For each missing dimension, select the most appropriate question
  missingDimensions.forEach(dimension => {
    const dim = UNIVERSAL_DIMENSIONS[dimension as keyof UniversalDimensions];
    if (dim) {
      // Use the main question as base
      questions.push(dim.question);
    }
  });
  
  return questions.slice(0, 3); // Max 3 questions
}

// FAS 3: Map checklist to universal dimensions
export function mapChecklistToDimensions(checklist: any): string[] {
  const missing: string[] = [];
  
  if (!checklist) {
    return ['scope', 'size', 'materials'];
  }
  
  if (!checklist.scope) missing.push('scope');
  if (!checklist.size) missing.push('size');
  if (!checklist.materials) missing.push('materials');
  if (!checklist.specialRequirements) missing.push('complexity');
  
  return missing;
}
