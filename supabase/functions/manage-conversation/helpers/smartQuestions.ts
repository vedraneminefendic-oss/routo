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
  
  // 1. BATHROOM RENOVATION
  if (desc.includes('badrum') && (desc.includes('renovera') || desc.includes('renovering') || desc.includes('nytt'))) {
    return {
      projectType: 'bathroom_renovation',
      mandatoryQuestions: [
        'Är det en totalrenovering (allt rivs och görs nytt) eller en delrenovering (vissa delar)?',
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
  
  // 2. KITCHEN RENOVATION
  if (desc.includes('kök') && (desc.includes('renovera') || desc.includes('renovering') || desc.includes('nytt'))) {
    return {
      projectType: 'kitchen_renovation',
      mandatoryQuestions: [
        'Är det en totalrenovering eller delrenovering (t.ex. bara skåpbyte)?',
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
  
  // 3. PAINTING
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
  
  // 4. TREE FELLING
  if (desc.includes('fälla') || desc.includes('fällning') || desc.includes('fallning') || (desc.includes('träd') && (desc.includes('ta ner') || desc.includes('såga')))) {
    return {
      projectType: 'tree_felling',
      mandatoryQuestions: [
        'Hur många träd ska fällas?',
        'Ungefärlig höjd på träden (meter)?',
        'Ungefärlig diameter på stammarna (vid brösthöjd, i cm)?',
        'Ska träden kapas och forslas bort, eller lämnas på plats?',
        'Finns det tillgång för maskin eller måste allt göras manuellt?',
        'Ska stubbarna fräsas bort eller lämnas kvar?'
      ],
      optionalQuestions: [
        'Behövs tillstånd från kommunen?',
        'Finns det risk för skada på byggnader/ledningar?'
      ],
      assumptions: [
        'Pris beror starkt på trädets höjd, diameter och tillgänglighet',
        'Stubbfräsning tillkommer separat om önskas'
      ]
    };
  }
  
  // 5. STUMP GRINDING
  if (desc.includes('stubb') || desc.includes('stubbfräsning') || desc.includes('fräsa')) {
    return {
      projectType: 'stump_grinding',
      mandatoryQuestions: [
        'Hur många stubbar ska fräsas?',
        'Ungefärlig diameter på stubbarna (cm)?',
        'Hur djupt ska stubbarna fräsas (cm under marknivå)?',
        'Ska flisen forslas bort eller lämnas på plats?'
      ],
      optionalQuestions: [
        'Finns det tillgång för fräsmaskin?'
      ],
      assumptions: [
        'Priset är per stubb',
        'Bortforsling av flis ingår'
      ]
    };
  }
  
  // 6. FLOORING
  if (desc.includes('golv') && (desc.includes('lägg') || desc.includes('nytt') || desc.includes('byte'))) {
    return {
      projectType: 'flooring',
      mandatoryQuestions: [
        'Vilken area ska läggas (kvm)?',
        'Typ av golv - laminat, parkett, vinyl?',
        'Ska gammalt golv rivas upp?',
        'Behövs nivåjustering av underlaget?',
        'Ska socklar monteras?'
      ],
      optionalQuestions: [
        'Behövs bortforsling av gammalt golv?',
        'Kvalitet på golvmaterial - budget/standard/premium?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi klickgolv/laminat'
      ]
    };
  }
  
  // 7. ROOFING
  if (desc.includes('tak') && (desc.includes('byte') || desc.includes('nytt') || desc.includes('lägg'))) {
    return {
      projectType: 'roofing',
      mandatoryQuestions: [
        'Vilken area har taket (kvm)?',
        'Typ av takmaterial - plåt, tegelpannor, papp?',
        'Ska gammalt tak rivas?',
        'Behövs nya takstolar eller förstärkning?',
        'Ska bortforsling av gammalt material ingå?'
      ],
      optionalQuestions: [
        'Behövs nya takfönster eller skorsten?',
        'Behövs isolering?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi plåttak',
        'Rivning och bortforsling ingår'
      ]
    };
  }
  
  // 8. CLEANING
  if (desc.includes('städ') || desc.includes('städning')) {
    return {
      projectType: 'cleaning',
      mandatoryQuestions: [
        'Vilken typ av städning - hemstädning, storstädning eller flyttstädning?',
        'Hur många kvadratmeter bostadsyta?',
        'Hur många rum (inkl kök och badrum)?',
        'Ska fönster putssas?'
      ],
      optionalQuestions: [
        'Ska ugn och spis djuprengöras?',
        'Finns det husdjur (kan påverka tid)?'
      ],
      assumptions: [
        'Priset baseras på bostadens storlek och typ av städning'
      ]
    };
  }
  
  // 9. ELECTRICAL
  if (desc.includes('el') || desc.includes('elektriker') || desc.includes('elarbete')) {
    return {
      projectType: 'electrical',
      mandatoryQuestions: [
        'Vad ska göras - nya uttag, belysning, hela eldragning?',
        'Hur många rum berörs?',
        'Behövs ny dragning i väggar eller kan vi använda befintliga kanaler?',
        'Ska certifiering/kontroll ingå?'
      ],
      optionalQuestions: [
        'Behövs dimmers eller specialbrytare?',
        'Ska vi leverera armaturer?'
      ],
      assumptions: [
        'Kontroll och certifiering ingår alltid',
        'El-arbete måste utföras av behörig elektriker'
      ]
    };
  }
  
  // 10. PLUMBING
  if (desc.includes('vvs') || desc.includes('rör') || desc.includes('rörmokare')) {
    return {
      projectType: 'plumbing',
      mandatoryQuestions: [
        'Vad ska göras - nya vattenledningar, avlopp, armaturer?',
        'Hur många rum berörs?',
        'Behövs nya dragningar eller bara byte av armaturer?',
        'Ska trycksättning och kontroll ingå?'
      ],
      optionalQuestions: [
        'Ska vi leverera armaturer (kranar, blandare)?'
      ],
      assumptions: [
        'Kontroll och trycksättning ingår',
        'VVS-arbete måste utföras enligt branschregler'
      ]
    };
  }
  
  // 11. WINDOWS
  if (desc.includes('fönster') && (desc.includes('byte') || desc.includes('nya') || desc.includes('monter'))) {
    return {
      projectType: 'windows',
      mandatoryQuestions: [
        'Hur många fönster ska bytas?',
        'Typ av fönster - trä, aluminium, PVC?',
        'Vilka mått har fönstren (ungefär)?',
        'Ska gamla fönster demonteras och forslas bort?',
        'Behövs isolering och tätning runt karmarna?'
      ],
      optionalQuestions: [
        'Ska fönsterkarmar målas?',
        'Kvalitet på glas - 2-glas eller 3-glas?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi standardfönster med 2-glas'
      ]
    };
  }
  
  // 12. FACADE
  if (desc.includes('fasad') && (desc.includes('renovering') || desc.includes('puts') || desc.includes('målning'))) {
    return {
      projectType: 'facade',
      mandatoryQuestions: [
        'Vilken area har fasaden (kvm)?',
        'Vad ska göras - ny puts, reparation eller bara målning?',
        'Behövs ställning?',
        'Ska gammalt material tas bort först?'
      ],
      optionalQuestions: [
        'Behövs isolering?',
        'Kvalitet på puts/färg - budget/standard/premium?'
      ],
      assumptions: [
        'Ställning ingår alltid',
        'Rengöring och förberedelser ingår'
      ]
    };
  }
  
  // 13. LANDSCAPE
  if (desc.includes('trädgård') && !desc.includes('fälla')) {
    return {
      projectType: 'landscape',
      mandatoryQuestions: [
        'Vilken area har trädgården (kvm)?',
        'Vad ska göras - gräsmatta, plantering, stenläggning?',
        'Behövs markarbete (planering, fyllning)?',
        'Ska gammalt material (gräs, buskar) tas bort?'
      ],
      optionalQuestions: [
        'Behövs bevattningssystem?',
        'Ska vi leverera växter och material?'
      ],
      assumptions: [
        'Bortforsling av gammalt material ingår om nödvändigt'
      ]
    };
  }
  
  // 14. INSULATION
  if (desc.includes('isoler') || desc.includes('energi')) {
    return {
      projectType: 'insulation',
      mandatoryQuestions: [
        'Vilken area ska isoleras (kvm)?',
        'Var ska isolering göras - vind, källare, väggar?',
        'Typ av isolering - mineralull, cellplast, annat?',
        'Behövs åtkomst genom rivning av väggar/tak?'
      ],
      optionalQuestions: [
        'Ska vi återställa ytor efter isolering?',
        'Behövs ångspärr?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi mineralull'
      ]
    };
  }
  
  // 15. CARPENTRY
  if (desc.includes('snickeri') || desc.includes('snickare') || (desc.includes('bygg') && !desc.includes('badrum') && !desc.includes('kök'))) {
    return {
      projectType: 'carpentry',
      mandatoryQuestions: [
        'Vad ska byggas - altan, förråd, carport, annat?',
        'Ungefärliga mått (längd x bredd x höjd)?',
        'Material - trä (impregnerat/oljat), komposit?',
        'Behövs fundament eller befintligt underlag?',
        'Ska målning/oljning ingå?'
      ],
      optionalQuestions: [
        'Behövs bygglov?',
        'Kvalitet på material - budget/standard/premium?'
      ],
      assumptions: [
        'Om inget annat sägs, antar vi impregnerat trä'
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

// FAS 3 + FAS 9: BATCH QUESTIONS - Returnera flera frågor samtidigt med förbättrad logik
export function generateBatchQuestions(
  requirements: ProjectRequirements,
  askedQuestions: string[],
  answeredTopics: string[],
  maxQuestions: number = 6
): string[] {
  const questions: string[] = [];
  
  console.log('🔍 GENERATING BATCH QUESTIONS:');
  console.log('  Project type:', requirements.projectType);
  console.log('  Mandatory questions available:', requirements.mandatoryQuestions.length);
  console.log('  Already asked:', askedQuestions.length);
  console.log('  Already answered topics:', answeredTopics);
  
  // PRIORITERA SCOPE-FRÅGOR FÖRST (totalrenovering/delrenovering)
  const scopeQuestions = requirements.mandatoryQuestions.filter(q =>
    q.toLowerCase().includes('total') || q.toLowerCase().includes('del') || q.toLowerCase().includes('typ av')
  );
  
  for (const question of scopeQuestions) {
    if (questions.length >= maxQuestions) break;
    if (!matchesSynonymOrTopic(question, askedQuestions, answeredTopics)) {
      questions.push(question);
      console.log('    ✅ Added scope question:', question);
    }
  }
  
  // SEDAN ANDRA OBLIGATORISKA FRÅGOR
  for (const question of requirements.mandatoryQuestions) {
    if (questions.length >= maxQuestions) break;
    if (scopeQuestions.includes(question)) continue; // Redan tillagd
    
    if (!matchesSynonymOrTopic(question, askedQuestions, answeredTopics)) {
      questions.push(question);
      console.log('    ✅ Added mandatory question:', question);
    }
  }
  
  // FYLL PÅ MED VALFRIA FRÅGOR OM PLATS
  if (questions.length < maxQuestions) {
    for (const question of requirements.optionalQuestions) {
      if (questions.length >= maxQuestions) break;
      if (!matchesSynonymOrTopic(question, askedQuestions, answeredTopics)) {
        questions.push(question);
        console.log('    ✅ Added optional question:', question);
      }
    }
  }
  
  console.log('  📊 Total questions generated:', questions.length);
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
