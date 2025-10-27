// ============================================================================
// SMART QUESTIONS - FAS 3: Batch-frågor och synonym-mapping
// ============================================================================

export interface ProjectRequirements {
  projectType: string;
  mandatoryQuestions: string[];
  optionalQuestions: string[];
  assumptions: string[];
}

// FAS 3: KEYWORD SYNONYMS - Förstår användarens input
export const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'rivning': ['bilning', 'bila', 'riva', 'demontera'],
  'vvs': ['rör', 'vatten', 'avlopp'],
  'el': ['elarbete', 'eluttag', 'belysning'],
  'målning': ['måla', 'målar', 'färg'],
  'kakel': ['klinker', 'plattsättning'],
  'fällning': ['fälla', 'fallning', 'såga']
};

export function getProjectRequirements(description: string): ProjectRequirements {
  const desc = description.toLowerCase();
  
  // BATHROOM RENOVATION
  if (desc.includes('badrum') && (desc.includes('renovera') || desc.includes('renovering') || desc.includes('nytt'))) {
    return {
      projectType: 'bathroom_renovation',
      mandatoryQuestions: [
        'Är det en totalrenovering (allt rivs och görs nytt) eller en delrenovering (vissa delar)?', // FAS 3: Scope question first!
        'Vilken area har badrummet (kvm)?',
        'Ska rivning av befintligt badrum ingå?',
        'Golvvärme - ska ny installeras eller behålla befintlig?',
        'El-installation - behövs ny dragning eller bara byte av armaturer?',
        'Ventilation - ska ny fläkt installeras?',
        'Kvalitet på kakel - budget/standard/premium?'
      ],
      optionalQuestions: [
        'Behövs bortforsling av rivningsmaterial?',
        'Ska vi också måla taket?',
        'Några specialönskemål (regndusch, inbyggda nischer, etc.)?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi standardkvalitet på alla material',
        'VVS, el, golvvärme, och ventilation ingår ALLTID i en totalrenovering',
        'Tätskiktsarbete och certifikat är obligatoriskt enligt branschregler'
      ]
    };
  }
  
  // KITCHEN RENOVATION
  if (desc.includes('kök') && (desc.includes('renovera') || desc.includes('renovering') || desc.includes('nytt'))) {
    return {
      projectType: 'kitchen_renovation',
      mandatoryQuestions: [
        'Är det en totalrenovering eller delrenovering (t.ex. bara skåpbyte)?', // FAS 3: Scope question first!
        'Vilken area har köket (kvm)?',
        'Ska befintligt kök rivas?',
        'Behövs nya VVS-dragningar (diskho, diskmaskin)?',
        'El-installation - nya uttag, spisplatta, fläkt?',
        'Kvalitet på skåp och bänkskiva?'
      ],
      optionalQuestions: [
        'Vitvaror - ska vi leverera eller kunden ordnar?',
        'Golv - nytt eller befintligt?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi standardkvalitet på skåp och bänkskiva',
        'VVS och el-installation ingår i en totalrenovering'
      ]
    };
  }
  
  // PAINTING
  if (desc.includes('måla') || desc.includes('målning')) {
    return {
      projectType: 'painting',
      mandatoryQuestions: [
        'Hur många kvadratmeter väggyta?',
        'Hur många strykningar (1 eller 2)?',
        'Kulör - vit/ljus eller mörkare färg?',
        'Ska taket målas också?'
      ],
      optionalQuestions: [
        'Behövs spackling/slipning innan målning?',
        'Ska vi skydda golv och möbler?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi 2 strykningar och ljus färg'
      ]
    };
  }
  
  // DEFAULT
  return {
    projectType: 'general',
    mandatoryQuestions: [],
    optionalQuestions: [],
    assumptions: []
  };
}

// FAS 3: Normalize keyword to canonical form
function normalizeKeyword(word: string): string {
  const normalized = word.toLowerCase().trim();
  
  for (const [canonical, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return canonical;
    }
  }
  
  return normalized;
}

// FAS 3: Check if question matches synonym or topic
function matchesSynonymOrTopic(question: string, askedQuestions: string[], answeredTopics: string[]): boolean {
  const questionWords = question.toLowerCase().split(' ').slice(0, 5).join(' ');
  
  // Check if already asked
  const alreadyAsked = askedQuestions.some(q => 
    q.toLowerCase().includes(questionWords)
  );
  
  if (alreadyAsked) return true;
  
  // Check if topic answered (with synonym matching)
  for (const topic of answeredTopics) {
    const normalizedTopic = normalizeKeyword(topic);
    if (question.toLowerCase().includes(normalizedTopic)) {
      return true;
    }
  }
  
  return false;
}

// FAS 3: BATCH QUESTIONS - Returnera flera frågor samtidigt
export function generateBatchQuestions(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[],
  maxQuestions: number = 6
): string[] {
  const questions: string[] = [];
  
  // Prioritera obligatoriska frågor
  for (const question of requirements.mandatoryQuestions) {
    if (questions.length >= maxQuestions) break;
    
    if (!matchesSynonymOrTopic(question, askedQuestions, answeredTopics)) {
      questions.push(question);
    }
  }
  
  // Lägg till optionella om vi har plats
  if (questions.length < maxQuestions) {
    for (const question of requirements.optionalQuestions) {
      if (questions.length >= maxQuestions) break;
      
      if (!matchesSynonymOrTopic(question, askedQuestions, answeredTopics)) {
        questions.push(question);
      }
    }
  }
  
  return questions;
}

// Legacy single-question mode (fallback)
export function generateNextQuestion(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[]
): string | null {
  const batch = generateBatchQuestions(requirements, askedQuestions, answeredTopics, 1);
  return batch.length > 0 ? batch[0] : null;
}
