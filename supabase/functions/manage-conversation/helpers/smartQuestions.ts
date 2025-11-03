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
// ADAPTIVE QUESTIONS - Project-specific question templates
// ============================================================================

interface AdaptiveQuestionSet {
  low_completeness: string[];
  missing_materials: string[];
  missing_scope: string[];
  missing_budget: string[];
}

export const ADAPTIVE_QUESTIONS: Record<string, AdaptiveQuestionSet> = {
  'badrum': {
    low_completeness: [
      'Hur ser fuktförhållandena ut i badrummet? Finns risk för fuktproblem?',
      'Finns det befintlig golvvärme, eller vill du installera ny?',
      'Ska du köpa kakel/klinker och inredning själv, eller vill du att det ingår i offerten?'
    ],
    missing_materials: [
      'Vilken standard tänker du dig på kakel/klinker? (Budget 200-400 kr/kvm, Mellan 400-800, Premium 800+)',
      'Har du redan valt inredning (WC, dusch, tvättställ) eller vill du ha hjälp med det?'
    ],
    missing_scope: [
      'Är det en totalrenovering med rivning, eller ska befintliga installationer behållas?',
      'Behöver ventilationen uppgraderas? (Viktigt i källarbadrum för att undvika mögel)'
    ],
    missing_budget: [
      'Har du en ungefärlig budget i åtanke för projektet?'
    ]
  },
  'kök': {
    low_completeness: [
      'Behåller du befintliga vitvaror, eller ska nya ingå?',
      'Tänker du dig IKEA-kök eller specialbeställt snickeri?',
      'Behöver ventilation och el uppgraderas för nya vitvaror?'
    ],
    missing_materials: [
      'Vilken stil tänker du dig? (Modern, klassisk, lantlig)',
      'Bänkskiva i laminat, kompositsten eller natursten?'
    ],
    missing_scope: [
      'Ska stomme och rörinstallationer behållas eller göras om helt?',
      'Behövs nya eluttag eller vattenanslutningar?'
    ],
    missing_budget: [
      'Har du en ungefärlig budget i åtanke för projektet?'
    ]
  },
  'målning': {
    low_completeness: [
      'Vilka ytor ska målas? (Väggar, tak, lister, dörrar)',
      'Behöver ytorna förberedas (spackling, slipning)?',
      'Önskar du miljövänlig färg eller standardfärg?'
    ],
    missing_materials: [
      'Har du redan färg hemma, eller ska vi köpa in allt?',
      'Önskar du matt, sidenmatt eller halvblank färg?'
    ],
    missing_scope: [
      'Ska möbler och golv skyddas/flyttas, eller är rummet redan tomt?'
    ],
    missing_budget: [
      'Har du en ungefärlig budget i åtanke för projektet?'
    ]
  },
  'default': {
    low_completeness: [
      'Hur stor är arbetsytan ungefär? (Kvm, meter, antal rum)',
      'Finns det några speciella krav eller önskemål?'
    ],
    missing_materials: [
      'Ska material ingå i offerten, eller köper du det själv?'
    ],
    missing_scope: [
      'Kan du beskriva arbetsomfattningen mer detaljerat?'
    ],
    missing_budget: [
      'Har du en ungefärlig budget i åtanke?'
    ]
  }
};

export function getAdaptiveQuestions(
  projectType: string,
  completeness: number,
  missingFields: string[]
): string[] {
  const questions: string[] = [];
  
  // Determine project category
  const category = Object.keys(ADAPTIVE_QUESTIONS).find(key => 
    projectType.toLowerCase().includes(key)
  ) || 'default';
  
  const questionSet = ADAPTIVE_QUESTIONS[category];
  
  // Select questions based on completeness and missing fields
  if (completeness < 30) {
    // Very incomplete - ask broad questions
    questions.push(...questionSet.low_completeness.slice(0, 3));
  } else if (completeness < 70) {
    // Moderately complete - ask targeted questions
    missingFields.forEach(field => {
      const fieldKey = `missing_${field}` as keyof AdaptiveQuestionSet;
      if (questionSet[fieldKey]) {
        questions.push(questionSet[fieldKey][0]);
      }
    });
    
    // Limit to 2 questions
    questions.splice(2);
  } else {
    // Mostly complete - ask 1 confirmation question
    if (questionSet.missing_budget) {
      questions.push(questionSet.missing_budget[0]);
    }
  }
  
  return questions;
}
