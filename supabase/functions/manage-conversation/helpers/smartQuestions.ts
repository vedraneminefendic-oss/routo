export interface ProjectRequirements {
  projectType: string;
  mandatoryQuestions: string[];
  optionalQuestions: string[];
  assumptions: string[];
}

export function getProjectRequirements(description: string): ProjectRequirements {
  const desc = description.toLowerCase();
  
  // BATHROOM RENOVATION
  if (desc.includes('badrum') && (desc.includes('renovera') || desc.includes('renovering') || desc.includes('nytt'))) {
    return {
      projectType: 'bathroom_renovation',
      mandatoryQuestions: [
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

export function generateNextQuestion(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[]
): string | null {
  
  // Hitta nästa obligatorisk fråga som inte ställts
  for (const question of requirements.mandatoryQuestions) {
    const alreadyAsked = askedQuestions.some(q => 
      q.toLowerCase().includes(question.toLowerCase().split(' ').slice(0, 3).join(' '))
    );
    
    if (!alreadyAsked) {
      return question;
    }
  }
  
  // Om alla obligatoriska är besvarade, kolla optionella
  for (const question of requirements.optionalQuestions) {
    const alreadyAsked = askedQuestions.some(q => 
      q.toLowerCase().includes(question.toLowerCase().split(' ').slice(0, 3).join(' '))
    );
    
    if (!alreadyAsked) {
      return question;
    }
  }
  
  return null; // Inga fler frågor
}
