// ============================================================================
// PROJECT STANDARDS - Branschkunskap för 15 projekttyper
// ============================================================================
// Detta är AI:ns "kunskap" om vad som ingår i olika typer av projekt.
// Används för att inkludera obligatoriska arbetsmoment även om användaren
// inte explicit nämnde dem.

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

// FAS 5: PROJECT INTENT
export interface ProjectIntent {
  scope: 'total' | 'partial' | 'new' | 'unknown';
  urgency: 'urgent' | 'normal' | 'flexible';
  quality: 'budget' | 'standard' | 'premium';
  explicitInclusions: string[];
  explicitExclusions: string[];
  specialRequirements: string[];
}

// FAS 2: Detect scope
export function detectScope(description: string): 'total' | 'partial' | 'new' | 'unknown' {
  const lower = description.toLowerCase();
  const totalKeywords = ['totalrenovering', 'total renovering', 'hel renovering', 'komplett renovering'];
  const partialKeywords = ['delrenovering', 'upprustning', 'uppfräschning'];
  
  if (totalKeywords.some(kw => lower.includes(kw))) return 'total';
  if (partialKeywords.some(kw => lower.includes(kw))) return 'partial';
  return 'unknown';
}

// FAS 5: Detect project intent
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

export const PROJECT_STANDARDS: ProjectStandard[] = [
  // 1. BADRUMSRENOVERING
  {
    projectType: 'bathroom_renovation',
    displayName: 'Badrumsrenovering',
    keywords: ['badrum', 'badrummet', 'wc', 'dusch', 'våtrum', 'totalrenovering badrum'],
    mandatoryWorkItems: [
      { name: 'Rivning befintligt badrum', minHours: 8, maxHours: 16, hourlyRate: 750, description: 'Demontering av kakel, sanitet, armaturer', mandatory: true },
      { name: 'VVS-installation', minHours: 14, maxHours: 24, hourlyRate: 950, description: 'Diskho, dusch, WC, golvbrunn, vattenlås', mandatory: true },
      { name: 'El-installation', minHours: 12, maxHours: 18, hourlyRate: 950, description: 'Uttag, armatur, takfläkt, jordfelsbrytare', mandatory: true },
      { name: 'Tätskikt och certifikat', minHours: 8, maxHours: 12, hourlyRate: 900, description: 'Tätskiktsarbete enligt branschregler', mandatory: true },
      { name: 'Golvvärme installation', minHours: 6, maxHours: 10, hourlyRate: 850, description: 'Elmatta eller vattenburen golvvärme', mandatory: true },
      { name: 'Ventilation och fläkt', minHours: 4, maxHours: 8, hourlyRate: 850, description: 'Fläktinstallation med aggregat', mandatory: true },
      { name: 'Kakel och klinker', minHours: 16, maxHours: 32, hourlyRate: 850, description: 'Plattsättning golv och väggar', mandatory: true },
      { name: 'Montering av sanitet', minHours: 6, maxHours: 10, hourlyRate: 800, description: 'Toalettstol, handfat, duschblandare', mandatory: true },
      { name: 'Slutbesiktning och städning', minHours: 4, maxHours: 6, hourlyRate: 700, description: 'Kontroll och slutstädning', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Bortforsling av rivningsmaterial', minHours: 2, maxHours: 4, hourlyRate: 700, description: 'Transport till depå', mandatory: false },
      { name: 'Målning av tak', minHours: 2, maxHours: 4, hourlyRate: 650, description: 'Takmålning om önskas', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Kakel och klinker', minCost: 3000, maxCost: 15000, unit: 'kvm' },
      { name: 'Tätskiktsmembran', minCost: 2000, maxCost: 5000 },
      { name: 'Golvvärme-matta', minCost: 3000, maxCost: 8000 },
      { name: 'VVS-material (rör, ventiler)', minCost: 8000, maxCost: 20000 },
      { name: 'El-material (kablar, uttag)', minCost: 4000, maxCost: 10000 },
      { name: 'Sanitet (toalett, handfat, dusch)', minCost: 10000, maxCost: 40000 }
    ],
    minCostPerSqm: 18000,
    maxCostPerSqm: 30000,
    warnings: [
      'Tätskikt och certifikat är obligatoriskt enligt branschregler',
      'VVS och El måste utföras av behörig personal',
      'Golvvärme och ventilation ingår ALLTID i totalrenovering'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi standardkvalitet på kakel och sanitet',
      'VVS, el, golvvärme och ventilation ingår i totalrenovering',
      'Rivning ingår om det är befintligt badrum'
    ]
  },

  // 2. KÖKSRENOVERING
  {
    projectType: 'kitchen_renovation',
    displayName: 'Köksrenovering',
    keywords: ['kök', 'köket', 'totalrenovering kök'],
    mandatoryWorkItems: [
      { name: 'Rivning befintligt kök', minHours: 10, maxHours: 16, hourlyRate: 750, description: 'Demontering skåp, bänkskivor, vitvaror', mandatory: true },
      { name: 'VVS-installation', minHours: 8, maxHours: 14, hourlyRate: 950, description: 'Diskho, diskmaskin, vatten/avlopp', mandatory: true },
      { name: 'El-installation', minHours: 12, maxHours: 20, hourlyRate: 950, description: 'Spisplatta, ugn, fläkt, uttag', mandatory: true },
      { name: 'Montering skåp och bänkskiva', minHours: 16, maxHours: 28, hourlyRate: 850, description: 'Montering alla skåp och bänkar', mandatory: true },
      { name: 'Väggbeklädnad', minHours: 8, maxHours: 16, hourlyRate: 800, description: 'Kakel eller målning', mandatory: true },
      { name: 'Slutbesiktning och städning', minHours: 4, maxHours: 6, hourlyRate: 700, description: 'Kontroll och städning', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Golv', minHours: 8, maxHours: 16, hourlyRate: 750, description: 'Nytt köksgolv', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Köksskåp', minCost: 30000, maxCost: 80000 },
      { name: 'Bänkskiva', minCost: 8000, maxCost: 25000 },
      { name: 'Diskho och blandare', minCost: 4000, maxCost: 12000 },
      { name: 'Köksfläkt', minCost: 3000, maxCost: 15000 },
      { name: 'VVS-material', minCost: 5000, maxCost: 12000 },
      { name: 'El-material', minCost: 6000, maxCost: 15000 }
    ],
    minCostPerSqm: 12000,
    maxCostPerSqm: 20000,
    warnings: [
      'El-installationer måste utföras av behörig elektriker',
      'VVS-arbete enligt branschregler'
    ],
    assumptions: [
      'VVS och el-installation ingår i totalrenovering',
      'Rivning av befintligt kök ingår'
    ]
  },

  // 3. MÅLNING
  {
    projectType: 'painting',
    displayName: 'Målning',
    keywords: ['måla', 'målning', 'målar', 'färg', 'stryk'],
    mandatoryWorkItems: [
      { name: 'Förberedelser och skydd', minHours: 2, maxHours: 4, hourlyRate: 650, description: 'Skydda golv och möbler', mandatory: true },
      { name: 'Spackling och slipning', minHours: 2, maxHours: 6, hourlyRate: 700, description: 'Reparera hål och ojämnheter', mandatory: true },
      { name: 'Grundmålning', minHours: 3, maxHours: 6, hourlyRate: 650, description: 'Första strykning', mandatory: true },
      { name: 'Slutstrykningar', minHours: 4, maxHours: 8, hourlyRate: 650, description: '1-2 slutstrykningar', mandatory: true },
      { name: 'Städning och efterarbete', minHours: 2, maxHours: 4, hourlyRate: 600, description: 'Ta bort skydd och städa', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Takmålning', minHours: 2, maxHours: 6, hourlyRate: 700, description: 'Om taket ska målas', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Färg', minCost: 500, maxCost: 2000, unit: 'liter' },
      { name: 'Spackel', minCost: 200, maxCost: 800 },
      { name: 'Maskering och skyddsduk', minCost: 300, maxCost: 800 }
    ],
    minCostPerSqm: 150,
    maxCostPerSqm: 350,
    warnings: [
      'Priset varierar beroende på antal strykningar',
      'Mörka färger kan kräva extra strykningar'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi 2 strykningar och ljus färg'
    ]
  },

  // 4. TRÄDGÅRD - FÄLLNING
  {
    projectType: 'tree_felling',
    displayName: 'Trädfällning',
    keywords: ['fälla', 'fällning', 'träd', 'granar', 'tallar', 'fallning'],
    mandatoryWorkItems: [
      { name: 'Fällning av träd', minHours: 2, maxHours: 8, hourlyRate: 950, description: 'Motorsågarbete och säker fällning', mandatory: true },
      { name: 'Kapning och uppdelning', minHours: 2, maxHours: 6, hourlyRate: 800, description: 'Kapning i transportlängder', mandatory: true },
      { name: 'Bortforsling', minHours: 1, maxHours: 4, hourlyRate: 750, description: 'Transport till depå eller vedgård', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Stubbfräsning', minHours: 1, maxHours: 3, hourlyRate: 900, description: 'Fräsning av stubbar', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Bränsle och smörjmedel', minCost: 300, maxCost: 1000 },
      { name: 'Avfallskostnader', minCost: 500, maxCost: 2000 }
    ],
    minCostFlat: 5000,
    maxCostFlat: 25000,
    warnings: [
      'Priset varierar kraftigt beroende på trädens storlek och placering',
      'Svåråtkomliga träd kostar mer'
    ],
    assumptions: [
      'Priset är per träd',
      'Kapning och bortforsling ingår'
    ]
  },

  // 5. STUBBFRÄSNING
  {
    projectType: 'stump_grinding',
    displayName: 'Stubbfräsning',
    keywords: ['stubb', 'stubbfräsning', 'fräsa', 'stubbar'],
    mandatoryWorkItems: [
      { name: 'Stubbfräsning', minHours: 1, maxHours: 3, hourlyRate: 900, description: 'Fräsning med maskin', mandatory: true },
      { name: 'Bortforsling av flis', minHours: 0.5, maxHours: 2, hourlyRate: 750, description: 'Hantering av flis', mandatory: true }
    ],
    optionalWorkItems: [],
    mandatoryMaterials: [
      { name: 'Maskinhyra och bränsle', minCost: 1000, maxCost: 3000 }
    ],
    minCostFlat: 2000,
    maxCostFlat: 8000,
    warnings: [
      'Priset beror på stubbens storlek och antal'
    ],
    assumptions: [
      'Priset är per stubb',
      'Bortforsling av flis ingår'
    ]
  },

  // 6. GOLVLÄGGNING
  {
    projectType: 'flooring',
    displayName: 'Golvläggning',
    keywords: ['golv', 'golvläggning', 'parkettgolv', 'laminat', 'klickgolv'],
    mandatoryWorkItems: [
      { name: 'Förberedelser och rivning', minHours: 2, maxHours: 6, hourlyRate: 700, description: 'Rivning av gammalt golv om nödvändigt', mandatory: true },
      { name: 'Planering och nivåjustering', minHours: 2, maxHours: 6, hourlyRate: 750, description: 'Nivåjustera underlaget', mandatory: true },
      { name: 'Läggning av golv', minHours: 4, maxHours: 10, hourlyRate: 800, description: 'Montering av golv', mandatory: true },
      { name: 'Sockelmontering', minHours: 2, maxHours: 4, hourlyRate: 650, description: 'Montering av socklar', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Bortforsling av gammalt golv', minHours: 1, maxHours: 3, hourlyRate: 700, description: 'Transport till depå', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Golvmaterial', minCost: 200, maxCost: 1000, unit: 'kvm' },
      { name: 'Underlagsmatta', minCost: 30, maxCost: 80, unit: 'kvm' },
      { name: 'Socklar', minCost: 50, maxCost: 150, unit: 'm' }
    ],
    minCostPerSqm: 300,
    maxCostPerSqm: 800,
    warnings: [
      'Priset varierar kraftigt beroende på golvtyp',
      'Parkett är dyrare än laminat'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi klickgolv/laminat'
    ]
  },

  // 7. TAKARBETE
  {
    projectType: 'roofing',
    displayName: 'Takarbete',
    keywords: ['tak', 'takläggning', 'takbyte', 'papp', 'plåt', 'tegelpannor'],
    mandatoryWorkItems: [
      { name: 'Rivning av gammalt tak', minHours: 8, maxHours: 20, hourlyRate: 800, description: 'Demontering av gammalt takmaterial', mandatory: true },
      { name: 'Underlagstak och papp', minHours: 6, maxHours: 16, hourlyRate: 850, description: 'Montering av underlagstak', mandatory: true },
      { name: 'Läggning av takmaterial', minHours: 16, maxHours: 40, hourlyRate: 900, description: 'Plåt, tegelpannor eller annan täckning', mandatory: true },
      { name: 'Beslag och takfot', minHours: 4, maxHours: 12, hourlyRate: 850, description: 'Montering av beslag', mandatory: true },
      { name: 'Bortforsling', minHours: 2, maxHours: 6, hourlyRate: 750, description: 'Bortforsling av gammalt material', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Takstolar och reparation', minHours: 8, maxHours: 24, hourlyRate: 900, description: 'Om takstolar behöver förstärkas', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Takmaterial (plåt/tegel)', minCost: 300, maxCost: 800, unit: 'kvm' },
      { name: 'Underlagspapp', minCost: 50, maxCost: 120, unit: 'kvm' },
      { name: 'Beslag och skruv', minCost: 5000, maxCost: 15000 }
    ],
    minCostPerSqm: 800,
    maxCostPerSqm: 1800,
    warnings: [
      'Priset varierar kraftigt beroende på takets lutning och tillgänglighet',
      'Plåt är billigare än tegelpannor'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi plåttak',
      'Rivning och bortforsling ingår'
    ]
  },

  // 8. STÄDNING
  {
    projectType: 'cleaning',
    displayName: 'Städning',
    keywords: ['städ', 'städning', 'storstäd', 'hemstäd', 'flyttstäd'],
    mandatoryWorkItems: [
      { name: 'Dammsugning och torkning', minHours: 2, maxHours: 6, hourlyRate: 500, description: 'Grundläggande städning', mandatory: true },
      { name: 'Badrum och kök', minHours: 1, maxHours: 3, hourlyRate: 550, description: 'Extra noggrann städning', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Fönsterputs', minHours: 1, maxHours: 4, hourlyRate: 550, description: 'Invändigt och utvändigt', mandatory: false },
      { name: 'Ugn och spis', minHours: 1, maxHours: 2, hourlyRate: 600, description: 'Djuprengöring', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Städmaterial och kemikalier', minCost: 200, maxCost: 600 }
    ],
    minCostFlat: 1500,
    maxCostFlat: 5000,
    warnings: [
      'Flyttstädning kostar mer än vanlig hemstädning'
    ],
    assumptions: [
      'Priset baseras på bostadens storlek och typ av städning'
    ]
  },

  // 9. EL-INSTALLATION
  {
    projectType: 'electrical',
    displayName: 'Elinstallation',
    keywords: ['el', 'elektriker', 'elarbete', 'eluttag', 'belysning', 'elfirma'],
    mandatoryWorkItems: [
      { name: 'Eldragning', minHours: 4, maxHours: 12, hourlyRate: 950, description: 'Dra nya elkablar', mandatory: true },
      { name: 'Montering av armaturer och uttag', minHours: 2, maxHours: 6, hourlyRate: 900, description: 'Installation av uttag och lampor', mandatory: true },
      { name: 'Kontroll och certifiering', minHours: 1, maxHours: 3, hourlyRate: 950, description: 'Elsäkerhetsverket kontroll', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Brytare och dimmer', minHours: 1, maxHours: 3, hourlyRate: 900, description: 'Installation av specialbrytare', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Elkablar', minCost: 500, maxCost: 3000 },
      { name: 'Eluttag och brytare', minCost: 1000, maxCost: 5000 },
      { name: 'Armaturer', minCost: 2000, maxCost: 10000 }
    ],
    minCostFlat: 5000,
    maxCostFlat: 25000,
    warnings: [
      'El-arbete måste utföras av behörig elektriker',
      'Certifiering är obligatorisk'
    ],
    assumptions: [
      'Kontroll och certifiering ingår alltid'
    ]
  },

  // 10. VVS-INSTALLATION
  {
    projectType: 'plumbing',
    displayName: 'VVS-installation',
    keywords: ['vvs', 'rör', 'rörmokare', 'vatten', 'avlopp', 'rörarbete'],
    mandatoryWorkItems: [
      { name: 'Rördragning', minHours: 6, maxHours: 16, hourlyRate: 950, description: 'Dra nya vattenledningar och avlopp', mandatory: true },
      { name: 'Montering av armaturer', minHours: 2, maxHours: 6, hourlyRate: 900, description: 'Installation av kranar och armaturer', mandatory: true },
      { name: 'Kontroll och trycksättning', minHours: 1, maxHours: 3, hourlyRate: 950, description: 'Testa systemet', mandatory: true }
    ],
    optionalWorkItems: [],
    mandatoryMaterials: [
      { name: 'VVS-rör', minCost: 2000, maxCost: 8000 },
      { name: 'Kopplingar och ventiler', minCost: 1500, maxCost: 5000 },
      { name: 'Armaturer', minCost: 3000, maxCost: 15000 }
    ],
    minCostFlat: 8000,
    maxCostFlat: 30000,
    warnings: [
      'VVS-arbete måste utföras enligt branschregler'
    ],
    assumptions: [
      'Kontroll och trycksättning ingår'
    ]
  },

  // 11. FÖNSTERBYTE
  {
    projectType: 'windows',
    displayName: 'Fönsterbyte',
    keywords: ['fönster', 'fönsterbyte', 'nya fönster', 'fönstermontering'],
    mandatoryWorkItems: [
      { name: 'Demontering gamla fönster', minHours: 2, maxHours: 6, hourlyRate: 750, description: 'Ta bort gamla fönster', mandatory: true },
      { name: 'Montering nya fönster', minHours: 4, maxHours: 12, hourlyRate: 850, description: 'Montera och justera', mandatory: true },
      { name: 'Isolering och tätning', minHours: 2, maxHours: 4, hourlyRate: 750, description: 'Tätning runt karmar', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Målning av fönsterkarmar', minHours: 2, maxHours: 6, hourlyRate: 700, description: 'Om önskas', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Fönster', minCost: 5000, maxCost: 20000, unit: 'st' },
      { name: 'Isolering och tätningsmedel', minCost: 500, maxCost: 2000 }
    ],
    minCostFlat: 8000,
    maxCostFlat: 35000,
    warnings: [
      'Priset varierar kraftigt beroende på fönstertyp och storlek'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi standardfönster'
    ]
  },

  // 12. FASADRENOVERING
  {
    projectType: 'facade',
    displayName: 'Fasadrenovering',
    keywords: ['fasad', 'fasadrenovering', 'puts', 'målning fasad', 'fasadputs'],
    mandatoryWorkItems: [
      { name: 'Ställningsuppbyggnad', minHours: 8, maxHours: 16, hourlyRate: 800, description: 'Montering av ställning', mandatory: true },
      { name: 'Rengöring och borttagning', minHours: 8, maxHours: 20, hourlyRate: 750, description: 'Ta bort lös puts och rengöra', mandatory: true },
      { name: 'Putsning och slipning', minHours: 16, maxHours: 40, hourlyRate: 850, description: 'Ny puts eller reparation', mandatory: true },
      { name: 'Målning', minHours: 12, maxHours: 30, hourlyRate: 750, description: 'Fasadmålning', mandatory: true },
      { name: 'Ställningsmontering', minHours: 4, maxHours: 8, hourlyRate: 800, description: 'Nedmontering', mandatory: true }
    ],
    optionalWorkItems: [],
    mandatoryMaterials: [
      { name: 'Puts', minCost: 100, maxCost: 300, unit: 'kvm' },
      { name: 'Fasadfärg', minCost: 50, maxCost: 150, unit: 'kvm' },
      { name: 'Ställningshyra', minCost: 10000, maxCost: 30000 }
    ],
    minCostPerSqm: 500,
    maxCostPerSqm: 1200,
    warnings: [
      'Priset varierar beroende på fasadens skick',
      'Ställningshyra är en stor kostnad'
    ],
    assumptions: [
      'Ställning ingår i priset'
    ]
  },

  // 13. ALTANBYGGE
  {
    projectType: 'deck',
    displayName: 'Altanbygge',
    keywords: ['altan', 'altanbygge', 'trädäck', 'veranda'],
    mandatoryWorkItems: [
      { name: 'Markarbeten och grund', minHours: 8, maxHours: 16, hourlyRate: 800, description: 'Förberedelse och plintar', mandatory: true },
      { name: 'Stomme och bärande konstruktion', minHours: 12, maxHours: 24, hourlyRate: 850, description: 'Byggande av stomme', mandatory: true },
      { name: 'Läggning av däck', minHours: 8, maxHours: 20, hourlyRate: 800, description: 'Montering av trall', mandatory: true },
      { name: 'Räcken och trappor', minHours: 4, maxHours: 12, hourlyRate: 800, description: 'Säkerhetsräcken', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Tak eller pergola', minHours: 8, maxHours: 20, hourlyRate: 850, description: 'Om önskas', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Trä (tryckimpregnerat)', minCost: 200, maxCost: 500, unit: 'kvm' },
      { name: 'Beslag och skruv', minCost: 2000, maxCost: 6000 },
      { name: 'Plintar och grund', minCost: 3000, maxCost: 10000 }
    ],
    minCostPerSqm: 2000,
    maxCostPerSqm: 4500,
    warnings: [
      'Priset varierar beroende på altanens höjd och komplexitet'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi tryckimpregnerat trä'
    ]
  },

  // 14. ISOLERING VIND
  {
    projectType: 'attic_insulation',
    displayName: 'Vind isolering',
    keywords: ['isolering', 'vind', 'vindsisolering', 'tilläggsisloering'],
    mandatoryWorkItems: [
      { name: 'Förberedelser och uppmätning', minHours: 2, maxHours: 4, hourlyRate: 700, description: 'Planera arbetet', mandatory: true },
      { name: 'Läggning av isolering', minHours: 6, maxHours: 16, hourlyRate: 750, description: 'Lägg ny isolering', mandatory: true },
      { name: 'Ventilation och tätning', minHours: 2, maxHours: 6, hourlyRate: 750, description: 'Se till att ventilation fungerar', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Borttransport av gammal isolering', minHours: 2, maxHours: 6, hourlyRate: 700, description: 'Om nödvändigt', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Isoleringsmaterial', minCost: 50, maxCost: 150, unit: 'kvm' },
      { name: 'Ångsperr och tejp', minCost: 500, maxCost: 2000 }
    ],
    minCostPerSqm: 150,
    maxCostPerSqm: 350,
    warnings: [
      'Ventilation måste säkerställas'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi mineralull'
    ]
  },

  // 15. TRÄDGÅRDSANLÄGGNING
  {
    projectType: 'landscaping',
    displayName: 'Trädgårdsanläggning',
    keywords: ['trädgårdsanläggning', 'anläggning', 'gräsmatta', 'plantering', 'trädgårdsdesign'],
    mandatoryWorkItems: [
      { name: 'Markarbeten och planering', minHours: 8, maxHours: 20, hourlyRate: 750, description: 'Planera och förbered mark', mandatory: true },
      { name: 'Växtbäddar och plantering', minHours: 6, maxHours: 16, hourlyRate: 700, description: 'Skapa växtbäddar', mandatory: true },
      { name: 'Gångar och stensättning', minHours: 8, maxHours: 20, hourlyRate: 800, description: 'Lägg gångar', mandatory: true }
    ],
    optionalWorkItems: [
      { name: 'Gräsmatta', minHours: 4, maxHours: 12, hourlyRate: 700, description: 'Anläggning av gräsmatta', mandatory: false },
      { name: 'Bevattningssystem', minHours: 4, maxHours: 12, hourlyRate: 850, description: 'Installation av bevattning', mandatory: false }
    ],
    mandatoryMaterials: [
      { name: 'Växter', minCost: 5000, maxCost: 25000 },
      { name: 'Jord och gödsel', minCost: 2000, maxCost: 8000 },
      { name: 'Gatsten och grus', minCost: 3000, maxCost: 15000 }
    ],
    minCostPerSqm: 300,
    maxCostPerSqm: 1000,
    warnings: [
      'Priset varierar kraftigt beroende på komplexitet'
    ],
    assumptions: [
      'Om inget annat sägs, antar vi grundläggande anläggning'
    ]
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function detectProjectType(description: string): ProjectStandard | null {
  const desc = description.toLowerCase();
  
  for (const standard of PROJECT_STANDARDS) {
    const matchesKeyword = standard.keywords.some(keyword => 
      desc.includes(keyword.toLowerCase())
    );
    
    if (matchesKeyword) {
      console.log(`🎯 Detected project type: ${standard.displayName}`);
      return standard;
    }
  }
  
  console.log('⚠️ Could not detect specific project type');
  return null;
}

export function getProjectPromptAddition(standard: ProjectStandard, area?: number): string {
  const totalMinCost = area && standard.minCostPerSqm 
    ? area * standard.minCostPerSqm 
    : standard.minCostFlat || 0;
    
  const totalMaxCost = area && standard.maxCostPerSqm 
    ? area * standard.maxCostPerSqm 
    : standard.maxCostFlat || 0;

  return `

🏗️ KRITISKT: Detta är ett ${standard.displayName.toUpperCase()}-projekt. Du MÅSTE inkludera:

OBLIGATORISKA ARBETSMOMENT (ALLTID INKLUDERA):
${standard.mandatoryWorkItems.map(item => 
  `- ${item.name}: ${item.description} (${item.minHours}-${item.maxHours}h @ ${item.hourlyRate} kr/h)`
).join('\n')}

OPTIONELLA ARBETSMOMENT (inkludera om nämnt):
${standard.optionalWorkItems.map(item => 
  `- ${item.name}: ${item.description} (${item.minHours}-${item.maxHours}h @ ${item.hourlyRate} kr/h)`
).join('\n')}

MATERIAL SOM ALLTID MÅSTE FINNAS MED:
${standard.mandatoryMaterials.map(m => {
  if (m.unit) {
    return `- ${m.name}: ${m.minCost}-${m.maxCost} kr/${m.unit}`;
  }
  return `- ${m.name}: ${m.minCost}-${m.maxCost} kr`;
}).join('\n')}

KOSTNADSKONTROLL:
${standard.minCostPerSqm 
  ? `- Minimum: ${standard.minCostPerSqm} kr/kvm
- Maximum: ${standard.maxCostPerSqm} kr/kvm
${area ? `- För ${area} kvm, bör totalen vara ${Math.round(totalMinCost)}-${Math.round(totalMaxCost)} kr` : ''}`
  : `- Minimum flat: ${standard.minCostFlat} kr
- Maximum flat: ${standard.maxCostFlat} kr`
}

VIKTIGA VARNINGAR:
${standard.warnings.map(w => `⚠️ ${w}`).join('\n')}

ANTAGANDEN (lägg till i assumptions om relevant):
${standard.assumptions.map(a => `- ${a}`).join('\n')}
`;
}

// ============================================================================
// SYNONYM MAPPING - För att förstå användarens input
// ============================================================================

export const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'rivning': ['bilning', 'bila', 'riva', 'demontera', 'ta bort'],
  'vvs': ['rör', 'vatten', 'avlopp', 'rörmokare'],
  'el': ['elarbete', 'eluttag', 'belysning', 'elektriker'],
  'målning': ['måla', 'målar', 'färg', 'stryk'],
  'kakel': ['klinker', 'plattsättning', 'kakelsättning'],
  'fällning': ['fälla', 'fallning', 'såga ner'],
  'städning': ['städ', 'storstäd', 'hemstäd', 'flyttstäd']
};

export function normalizeKeyword(word: string): string {
  const normalized = word.toLowerCase().trim();
  
  for (const [canonical, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return canonical;
    }
  }
  
  return normalized;
}
