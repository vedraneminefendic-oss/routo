// ============================================
// INDUSTRY STANDARDS - BRANSCHSTANDARDER
// ============================================

export interface JobStandard {
  jobType: string;
  category: 'rot' | 'rut' | 'none';
  
  // Tidsåtgång
  timePerUnit: {
    unit: 'kvm' | 'rum' | 'meter' | 'styck' | 'timme';
    min: number;    // Minsta tid (optimistiskt scenario)
    typical: number; // Typisk tid (använd detta som default)
    max: number;    // Maximal tid (komplicerat scenario)
  };
  
  // Prissättning
  hourlyRate: {
    budget: number;    // Lågt pris
    standard: number;  // Marknadspris
    premium: number;   // Högt pris
  };
  
  // Material (om relevant)
  materialCostPerUnit?: {
    min: number;
    typical: number;
    max: number;
  };
  
  // Varningar och antaganden
  warnings: string[];
  assumptions: string[];
  
  // Källa (referens)
  source: string;
  lastUpdated: string;
}

// ============================================
// BRANSCHSTANDARDER FÖR ALLA JOBBTYPER
// ============================================

export const INDUSTRY_STANDARDS: JobStandard[] = [
  // New additions for P1 - more comprehensive standards
  {
    jobType: 'hemstadning',
    category: 'rut',
    timePerUnit: { unit: 'kvm', min: 0.08, typical: 0.10, max: 0.12 },
    hourlyRate: { budget: 400, standard: 500, premium: 600 },
    materialCostPerUnit: { min: 5, typical: 8, max: 12 },
    warnings: ['Hemstädning är snabbare än flyttstäd', 'Enklare grundrengöring'],
    assumptions: ['Grundstädning av ytor', 'Inga fönster eller djupstädning'],
    source: 'Branschstandard hemstäd 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'storstädning',
    category: 'rut',
    timePerUnit: { unit: 'kvm', min: 0.12, typical: 0.15, max: 0.18 },
    hourlyRate: { budget: 450, standard: 500, premium: 550 },
    materialCostPerUnit: { min: 10, typical: 15, max: 20 },
    warnings: ['Storstädning inkluderar djupgående rengöring', 'Fönster kan ingå'],
    assumptions: ['Djupstädning av alla ytor', 'Extra noggrann städning'],
    source: 'Branschstandard storstäd 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'snöröjning',
    category: 'rut',
    timePerUnit: { unit: 'kvm', min: 0.008, typical: 0.010, max: 0.015 },
    hourlyRate: { budget: 400, standard: 500, premium: 600 },
    materialCostPerUnit: { min: 2, typical: 5, max: 10 },
    warnings: ['Mycket snö ökar tiden', 'Tillgång till redskap påverkar effektivitet'],
    assumptions: ['Normal snömängd', 'Enkel åtkomst'],
    source: 'Branschstandard snöröjning 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'lövräfsning',
    category: 'rut',
    timePerUnit: { unit: 'kvm', min: 0.005, typical: 0.008, max: 0.012 },
    hourlyRate: { budget: 400, standard: 500, premium: 600 },
    warnings: ['Mycket löv tar längre tid', 'Bortforsling av löv kan kosta extra'],
    assumptions: ['Normal mängd löv', 'Enkel åtkomst'],
    source: 'Branschstandard lövräfsning 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'golvslipning',
    category: 'rot',
    timePerUnit: { unit: 'kvm', min: 0.8, typical: 1.0, max: 1.3 },
    hourlyRate: { budget: 600, standard: 750, premium: 900 },
    materialCostPerUnit: { min: 50, typical: 80, max: 120 },
    warnings: ['Skadat golv tar längre tid', 'Möbler måste flyttas'],
    assumptions: ['Träparkettgolv', 'Normal slitning'],
    source: 'Branschstandard golvslipning 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'takmålning',
    category: 'rot',
    timePerUnit: { unit: 'kvm', min: 0.25, typical: 0.35, max: 0.45 },
    hourlyRate: { budget: 550, standard: 650, premium: 800 },
    materialCostPerUnit: { min: 25, typical: 40, max: 60 },
    warnings: ['Högt tak kräver ställning', 'Strukturput tar längre tid'],
    assumptions: ['2 lager takfärg', 'Standard takhöjd 2.4-2.7m'],
    source: 'Branschstandard målning 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'fönsterbyte',
    category: 'rot',
    timePerUnit: { unit: 'styck', min: 2.5, typical: 3.5, max: 5.0 },
    hourlyRate: { budget: 650, standard: 800, premium: 950 },
    materialCostPerUnit: { min: 3000, typical: 5000, max: 8000 },
    warnings: ['Äldre fönster kan kräva extra arbete', 'Fönster måste beställas i förväg'],
    assumptions: ['Standard tvåglasfönster', 'Normal installation'],
    source: 'Branschstandard fönsterbyte 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'altan_byggnad',
    category: 'rot',
    timePerUnit: { unit: 'kvm', min: 8, typical: 12, max: 18 },
    hourlyRate: { budget: 650, standard: 800, premium: 1000 },
    materialCostPerUnit: { min: 800, typical: 1200, max: 2000 },
    warnings: ['Bygglov kan krävas', 'Grund måste vara klar'],
    assumptions: ['Träaltan', 'Standard konstruktion'],
    source: 'Branschstandard altan 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'plåttak_läggning',
    category: 'rot',
    timePerUnit: { unit: 'kvm', min: 0.5, typical: 0.7, max: 1.0 },
    hourlyRate: { budget: 700, standard: 850, premium: 1000 },
    materialCostPerUnit: { min: 200, typical: 300, max: 500 },
    warnings: ['Brant tak tar längre tid', 'Fallskydd krävs'],
    assumptions: ['Plåttak', 'Normal lutning'],
    source: 'Branschstandard tak 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'isolering_vind',
    category: 'rot',
    timePerUnit: { unit: 'kvm', min: 0.3, typical: 0.5, max: 0.8 },
    hourlyRate: { budget: 550, standard: 700, premium: 850 },
    materialCostPerUnit: { min: 80, typical: 120, max: 180 },
    warnings: ['Lågt till tak försvårar arbetet', 'Befintlig isolering måste granskas'],
    assumptions: ['Mineralull', 'Enkel åtkomst'],
    source: 'Branschstandard isolering 2024',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'vattenskada_sanering',
    category: 'rot',
    timePerUnit: { unit: 'kvm', min: 2.0, typical: 3.5, max: 6.0 },
    hourlyRate: { budget: 750, standard: 900, premium: 1100 },
    materialCostPerUnit: { min: 200, typical: 400, max: 800 },
    warnings: ['Mögel kräver specialbehandling', 'Fuktmätning måste göras'],
    assumptions: ['Medelstor skada', 'Standard sanering'],
    source: 'Branschstandard sanering 2024',
    lastUpdated: '2025-01-15'
  },
  // ============================================
  // RUT - STÄDNING (Original items)
  // ============================================
  {
    jobType: 'flyttstadning',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.15,      // Snabb städning (nästan tom lägenhet)
      typical: 0.18,  // Normal städning
      max: 0.25       // Smutsig lägenhet med mycket arbete
    },
    hourlyRate: {
      budget: 350,
      standard: 450,
      premium: 550
    },
    warnings: [
      'Om lägenheten är mycket smutsig, lägg till 20-30% på tiden',
      'Fönsterputs ingår ofta inte - räkna separat om det krävs'
    ],
    assumptions: [
      'Grundlig flyttstädning enligt checklista',
      'Normal smutsgrad (inte djuprengöring)',
      'Standardmaterial ingår'
    ],
    source: 'Byggfakta.se, Hemfrid, Städarna - 2025',
    lastUpdated: '2025-11-02'
  },
  {
    jobType: 'hemstadning',
    category: 'rut',
    timePerUnit: {
      unit: 'timme',
      min: 1,
      typical: 1,
      max: 1
    },
    hourlyRate: {
      budget: 300,
      standard: 400,
      premium: 500
    },
    warnings: [],
    assumptions: ['RUT-avdrag 50%'],
    source: 'Hemfrid, Städarna - 2025',
    lastUpdated: '2025-11-02'
  },
  {
    jobType: 'fonsterputs',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.05,
      typical: 0.08,
      max: 0.12
    },
    hourlyRate: {
      budget: 400,
      standard: 500,
      premium: 600
    },
    warnings: ['Höga fönster kräver stege/skylift - lägg till 50% på tiden'],
    assumptions: ['In- och utsida', 'Normala fönster (ej panoramafönster)'],
    source: 'Byggfakta.se - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // RUT - TRÄDGÅRD
  // ============================================
  {
    jobType: 'grasklippning',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.002,
      typical: 0.003,
      max: 0.005
    },
    hourlyRate: {
      budget: 450,
      standard: 550,
      premium: 650
    },
    warnings: ['Ojämn mark eller mycket stenar ökar tiden'],
    assumptions: ['Gräsklippare ingår', 'Jämn mark'],
    source: 'Trädgårdsföreningen - 2025',
    lastUpdated: '2025-11-02'
  },
  {
    jobType: 'hakkklippning',
    category: 'rut',
    timePerUnit: {
      unit: 'meter',
      min: 0.08,
      typical: 0.10,
      max: 0.15
    },
    hourlyRate: {
      budget: 450,
      standard: 550,
      premium: 650
    },
    warnings: ['Mycket tjock häck tar längre tid'],
    assumptions: ['Normal häck 1.5-2m hög', 'Enkel åtkomst'],
    source: 'Trädgårdsföreningen - 2025',
    lastUpdated: '2025-11-02'
  },
  {
    jobType: 'tradfall',
    category: 'none', // Trädfällning är EJ RUT-berättigat
    timePerUnit: {
      unit: 'styck',
      min: 2,
      typical: 4,
      max: 8
    },
    hourlyRate: {
      budget: 800,
      standard: 1000,
      premium: 1200
    },
    warnings: [
      '⚠️ VARNING: Trädfällning är INTE RUT-berättigat!',
      'Priset varierar stort beroende på trädhöjd (5m vs 20m)',
      'Borttransport av grenar kostar extra (ca 2000-5000 kr)'
    ],
    assumptions: ['Träd 8-15m högt', 'Normal svårighetsgrad', 'Transport av grenar ingår EJ'],
    source: 'Arboristförbundet - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // RUT - TRÄDGÅRD MOMENT-SPECIFIKA STANDARDER
  // ============================================
  {
    jobType: 'plantering',
    category: 'rut',
    timePerUnit: {
      unit: 'styck',
      min: 0.3,      // Snabb plantering (små växter)
      typical: 0.5,  // Normal plantering
      max: 1.0       // Stor växt eller komplicerad plantering
    },
    hourlyRate: {
      budget: 450,
      standard: 550,
      premium: 650
    },
    materialCostPerUnit: {
      min: 50,
      typical: 150,
      max: 500
    },
    warnings: [
      'Stora träd och buskar tar längre tid',
      'Markberedning kan behövas (separat moment)'
    ],
    assumptions: [
      'Plantering av växt i förberedd jord',
      'Normal växtstorlek',
      'Enkel åtkomst'
    ],
    source: 'Trädgårdsföreningen 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'markberedning',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.2,      // Lätt markberedning (bra jord)
      typical: 0.4,  // Normal markberedning
      max: 0.7       // Tung markberedning (stenar, rötter)
    },
    hourlyRate: {
      budget: 450,
      standard: 550,
      premium: 650
    },
    materialCostPerUnit: {
      min: 20,
      typical: 40,
      max: 80
    },
    warnings: [
      'Mycket stenar och rötter ökar tiden kraftigt',
      'Ny jord kan behöva tillföras (extra kostnad)'
    ],
    assumptions: [
      'Grävning och grovberedning av mark',
      'Borttagning av stenar och rötter',
      'Normal jordkvalitet'
    ],
    source: 'Trädgårdsföreningen 2025',
    lastUpdated: '2025-11-04'
  },
  
  // ============================================
  // ROT - BADRUM
  // ============================================
  {
    jobType: 'badrumstotalrenovering',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 40,
      typical: 50,
      max: 70
    },
    hourlyRate: {
      budget: 700,
      standard: 850,
      premium: 1000
    },
    materialCostPerUnit: {
      min: 5000,
      typical: 8000,
      max: 15000
    },
    warnings: [
      'Fuktsanering kan lägga till 20-40% på kostnaden',
      'Rörinstallationer kräver certifierad VVS-montör',
      'Golvvärme rekommenderas i källare'
    ],
    assumptions: [
      'Inkluderar kakel, golvvärme, WC, handfat, dusch',
      'ROT-avdrag 50% på arbetskostnad'
    ],
    source: 'Byggfakta.se, ROT/RUT-guiden - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // ROT - BADRUM MOMENT-SPECIFIKA STANDARDER
  // ============================================
  {
    jobType: 'rivning_badrum',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 1.5,      // Snabb rivning (enklare material)
      typical: 2.5,  // Normal rivning
      max: 3.5       // Komplicerad (asbest, extra grejer)
    },
    hourlyRate: {
      budget: 650,
      standard: 750,
      premium: 900
    },
    warnings: [
      'Gamla kakeltyper tar längre tid att riva',
      'Asbest kräver specialhantering och utbildad personal'
    ],
    assumptions: [
      'Kakel och puts rivs ner till stommen',
      'Alla gamla rörinstallationer tas bort',
      'Transport och flakning ingår'
    ],
    source: 'Byggfakta ROT 2025',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'vvs_badrum',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 2.0,      // Enkel VVS-installation
      typical: 2.8,  // Normal installation
      max: 4.0       // Komplicerad (flyttad golvbrunn, gamla rör)
    },
    hourlyRate: {
      budget: 800,
      standard: 950,
      premium: 1100
    },
    warnings: [
      'Golvbrunn måste flyttas = +4h',
      'Gammalt rör som måste bytas = +30% tid'
    ],
    assumptions: [
      'Byte av rör, golvbrunn, blandare, WC, handfat',
      'Certifierad VVS-montör krävs',
      'Tryckprovning ingår'
    ],
    source: 'VVS-förbundet 2025',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'el_badrum',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 1.8,      // Enkel el-installation
      typical: 2.5,  // Normal installation
      max: 3.2       // Komplicerad (jordfelsbrytare, golvvärme)
    },
    hourlyRate: {
      budget: 850,
      standard: 950,
      premium: 1100
    },
    warnings: [
      'Jordfelsbrytare måste bytas = +2h',
      'IP44-krav i våtrum måste följas'
    ],
    assumptions: [
      'Golvvärme, IP44-armaturer, jordfelsbrytare',
      'Certifierad elektriker krävs',
      'Elsäkerhetskontroll ingår'
    ],
    source: 'Elinstallatörsförbundet 2025',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'kakel_vagg',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 1.5,      // Snabb kakelsättning
      typical: 2.2,  // Normal kakelsättning
      max: 3.0       // Komplicerad (mönster, små kakelplattor)
    },
    hourlyRate: {
      budget: 700,
      standard: 800,
      premium: 950
    },
    warnings: [
      'Mönster ökar tiden med 20%',
      'Tätskikt måste torka 24h före kakelsättning'
    ],
    assumptions: [
      'Tätskikt, kakel, fog',
      'Normala kakelplattor (20x30 cm)',
      'Standardfog (2-3mm)'
    ],
    source: 'Kakelsättarförbundet 2025',
    lastUpdated: '2025-01-15'
  },
  {
    jobType: 'klinker_golv',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 2.0,      // Snabb klinkersättning
      typical: 2.8,  // Normal klinkersättning
      max: 3.5       // Komplicerad (golvvärme, fall mot brunn)
    },
    hourlyRate: {
      budget: 700,
      standard: 850,
      premium: 1000
    },
    warnings: [
      'Golvvärme kräver extra precision',
      'Fall mot brunn ökar tiden med 30%'
    ],
    assumptions: [
      'Golvvärme, klinker, fog, fall mot brunn',
      'Tätskikt under klinker',
      'Normal klinkerstorlek (30x30 cm)'
    ],
    source: 'Kakelsättarförbundet 2025',
    lastUpdated: '2025-01-15'
  },
  
  // ============================================
  // ROT - KÖK
  // ============================================
  {
    jobType: 'kokrenovering',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 30,
      typical: 40,
      max: 60
    },
    hourlyRate: {
      budget: 700,
      standard: 850,
      premium: 1000
    },
    materialCostPerUnit: {
      min: 6000,
      typical: 10000,
      max: 20000
    },
    warnings: [
      'Golvbyte och elinstallationer tar tid',
      'Köksluckor och vitvaror köps ofta av kunden själv'
    ],
    assumptions: [
      'Inkluderar golv, el, vatten',
      'Köksinredning ingår EJ (köps separat av kunden)'
    ],
    source: 'Byggfakta.se, ROT/RUT-guiden - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // ROT - KÖK MOMENT-SPECIFIKA STANDARDER
  // ============================================
  {
    jobType: 'rivning_kok',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 1.2,      // Snabb rivning (IKEA-kök)
      typical: 2.0,  // Normal rivning
      max: 3.0       // Komplicerad (gamla skåp, mycket vitvaror)
    },
    hourlyRate: {
      budget: 650,
      standard: 750,
      premium: 900
    },
    warnings: [
      'Gamla skåp som är fastskruvade tar längre tid',
      'Vitvaror måste kopplas bort av certifierad elektriker'
    ],
    assumptions: [
      'Demontering av skåp, bänkskiva och backsplash',
      'Alla vitvaror kopplas bort',
      'Transport och flakning ingår'
    ],
    source: 'Byggfakta ROT 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'vvs_kok',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.8,      // Enkel VVS (bara diskho)
      typical: 1.2,  // Normal (diskho + diskmaskin)
      max: 2.0       // Komplicerad (flyttad diskho, nya rör)
    },
    hourlyRate: {
      budget: 800,
      standard: 950,
      premium: 1100
    },
    warnings: [
      'Flyttad diskho kräver nya rör = +4h',
      'Gamla rör kan behöva bytas = +30% tid'
    ],
    assumptions: [
      'Installation av diskho, diskblandare, diskmaskin',
      'Certifierad VVS-montör krävs',
      'Tryckprovning ingår'
    ],
    source: 'VVS-förbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'el_kok',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 1.0,      // Enkel el (bara uttag)
      typical: 1.5,  // Normal (uttag + spisplatta + fläkt)
      max: 2.5       // Komplicerad (ny elcentral, golvvärme)
    },
    hourlyRate: {
      budget: 850,
      standard: 950,
      premium: 1100
    },
    warnings: [
      'Spisplatta på 400V kräver separat uttag',
      'Fläkt måste kopplas till ventilation'
    ],
    assumptions: [
      'Installation av uttag, spisplatta, ugn, fläkt',
      'Certifierad elektriker krävs',
      'Elsäkerhetskontroll ingår'
    ],
    source: 'Elinstallatörsförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'kakel_kok',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 1.0,      // Snabb kakelsättning (backsplash)
      typical: 1.5,  // Normal kakelsättning
      max: 2.2       // Komplicerad (mönster, små kakelplattor)
    },
    hourlyRate: {
      budget: 700,
      standard: 800,
      premium: 950
    },
    warnings: [
      'Mönster ökar tiden med 20%',
      'Tätskikt rekommenderas bakom diskho'
    ],
    assumptions: [
      'Backsplash bakom diskbänk och spis',
      'Normala kakelplattor (20x30 cm)',
      'Standardfog (2-3mm)'
    ],
    source: 'Kakelsättarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'skåp_montering',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 3.0,      // Snabb montering (IKEA, färdigskåp)
      typical: 4.5,  // Normal montering (mellanklass)
      max: 7.0       // Komplicerad (specialsnickeri, justering)
    },
    hourlyRate: {
      budget: 650,
      standard: 750,
      premium: 900
    },
    warnings: [
      'Specialsnickeri tar dubbla tiden',
      'Bänkskiva i natursten kräver specialverktyg'
    ],
    assumptions: [
      'Montering av alla skåp, lådor och bänkskiva',
      'Justering av luckor och lådor',
      'Installation av handtag och knoppar'
    ],
    source: 'Byggfakta 2025',
    lastUpdated: '2025-11-04'
  },
  
  // ============================================
  // ROT - MÅLNING
  // ============================================
  {
    jobType: 'malning_inomhus',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.3,
      typical: 0.4,
      max: 0.6
    },
    hourlyRate: {
      budget: 550,
      standard: 650,
      premium: 800
    },
    materialCostPerUnit: {
      min: 30,
      typical: 50,
      max: 100
    },
    warnings: [
      'Strukturputsade väggar tar dubbla tiden',
      'Mörkare färger kräver extra lager'
    ],
    assumptions: [
      'Spackling och slipning ingår',
      '2 lager färg',
      'Standardfärg (mellanpris)'
    ],
    source: 'Målarförbundet - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // ROT/RUT - MÅLNING MOMENT-SPECIFIKA STANDARDER
  // ============================================
  {
    jobType: 'spackling_sliping',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.08,     // Minimal spackling (små hål)
      typical: 0.12, // Normal spackling
      max: 0.20      // Mycket spackling (stora skador)
    },
    hourlyRate: {
      budget: 550,
      standard: 650,
      premium: 800
    },
    materialCostPerUnit: {
      min: 8,
      typical: 12,
      max: 20
    },
    warnings: [
      'Stora hål och sprickor tar längre tid',
      'Strukturputsade väggar kan inte spacklas'
    ],
    assumptions: [
      'Spackling av hål och sprickor',
      'Slipning för jämn yta',
      'Grundning ingår EJ (separat moment)'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'grundning',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.06,     // Snabb grundning (rullning)
      typical: 0.10, // Normal grundning
      max: 0.15      // Noggrann grundning (pensling i kanter)
    },
    hourlyRate: {
      budget: 550,
      standard: 650,
      premium: 800
    },
    materialCostPerUnit: {
      min: 10,
      typical: 15,
      max: 25
    },
    warnings: [
      'Grundfärg måste torka 4-6h innan målning',
      'Mörka färger kräver pigmenterad grundning'
    ],
    assumptions: [
      'En grundstrykning',
      'Täcker spacklad yta',
      'Normalt uttorkningstid'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'malning_1_lager',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.10,     // Snabb målning (rullning)
      typical: 0.14, // Normal målning
      max: 0.20      // Noggrann målning (pensling, kanter)
    },
    hourlyRate: {
      budget: 550,
      standard: 650,
      premium: 800
    },
    materialCostPerUnit: {
      min: 15,
      typical: 25,
      max: 40
    },
    warnings: [
      'Första lagret tar längst tid (täcker ojämnheter)',
      'Strukturputsade väggar kräver mer färg'
    ],
    assumptions: [
      'Första strykning på grundad yta',
      'Normal täckförmåga',
      'Måste torka 4-6h innan andra lagret'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'malning_2_lager',
    category: 'rut',
    timePerUnit: {
      unit: 'kvm',
      min: 0.06,     // Snabb slutstrykning
      typical: 0.10, // Normal slutstrykning
      max: 0.14      // Noggrann slutstrykning
    },
    hourlyRate: {
      budget: 550,
      standard: 650,
      premium: 800
    },
    materialCostPerUnit: {
      min: 10,
      typical: 20,
      max: 35
    },
    warnings: [
      'Andra lagret går snabbare (redan täckt yta)',
      'Vissa mörka färger kan kräva tredje lager'
    ],
    assumptions: [
      'Slutstrykning på första lagret',
      'Snabbare arbete (redan täckt)',
      'Normal täckförmåga'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'malning_fasad',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.2,
      typical: 0.3,
      max: 0.5
    },
    hourlyRate: {
      budget: 550,
      standard: 700,
      premium: 900
    },
    materialCostPerUnit: {
      min: 50,
      typical: 80,
      max: 150
    },
    warnings: [
      'Ställning krävs över 4m höjd (kostnad 5000-15000 kr)',
      'Träfasad kräver mer förberedelser än puts'
    ],
    assumptions: [
      'Includes grundbehandling och tvätt',
      '2 lager utomhusfärg',
      'Normal fasad (ej mycket skador)'
    ],
    source: 'Målarförbundet - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // ROT - FASADMÅLNING MOMENT-SPECIFIKA STANDARDER
  // ============================================
  {
    jobType: 'fasad_rengoring',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.08,     // Snabb rengöring (högtryck)
      typical: 0.12, // Normal rengöring
      max: 0.18      // Noggrann rengöring (mögel, alger)
    },
    hourlyRate: {
      budget: 550,
      standard: 700,
      premium: 900
    },
    materialCostPerUnit: {
      min: 5,
      typical: 10,
      max: 20
    },
    warnings: [
      'Mögel och alger kräver specialbehandling',
      'Fasaden måste torka 24-48h innan målning'
    ],
    assumptions: [
      'Högtryckstvätt av fasad',
      'Borttagning av lös färg',
      'Normal smutsgrad'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'fasad_forberedelse',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.04,     // Minimal förberedelse
      typical: 0.08, // Normal förberedelse
      max: 0.15      // Mycket förberedelse (sprickor, skador)
    },
    hourlyRate: {
      budget: 550,
      standard: 700,
      premium: 900
    },
    materialCostPerUnit: {
      min: 8,
      typical: 15,
      max: 30
    },
    warnings: [
      'Stora sprickor måste lagas innan målning',
      'Träfasad kräver mer slipning än puts'
    ],
    assumptions: [
      'Spackling av sprickor',
      'Slipning av lös färg',
      'Grundbehandling av träytor'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'fasad_malning',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.25,     // Snabb målning (spray)
      typical: 0.35, // Normal målning
      max: 0.50      // Noggrann målning (pensling, detaljer)
    },
    hourlyRate: {
      budget: 550,
      standard: 700,
      premium: 900
    },
    materialCostPerUnit: {
      min: 40,
      typical: 70,
      max: 120
    },
    warnings: [
      'Träfasad kräver 2-3 lager',
      'Detaljer och prydnader ökar tiden med 30%'
    ],
    assumptions: [
      '2 lager fasadfärg',
      'Normal fasad utan mycket detaljer',
      'Standard sprayning eller rullning'
    ],
    source: 'Målarförbundet 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'stallning',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.5,      // Enkel ställning (lågpris hyra)
      typical: 1.0,  // Normal ställning
      max: 1.8       // Komplicerad ställning (högt, svår mark)
    },
    hourlyRate: {
      budget: 0,     // Ställning är oftast hyra, inte arbetskostnad
      standard: 0,
      premium: 0
    },
    materialCostPerUnit: {
      min: 100,      // Hyra per kvm fasad
      typical: 150,
      max: 250
    },
    warnings: [
      'Ställning över 4m höjd är lagkrav',
      'Hyra beräknas per vecka (ca 4-6 veckor)',
      'Uppställning och nedtagning tillkommer'
    ],
    assumptions: [
      'Hyra av ställning för 4-6 veckor',
      'Uppställning och nedtagning ingår',
      'Normal fasadhöjd (4-8m)'
    ],
    source: 'Byggfakta 2025',
    lastUpdated: '2025-11-04'
  },
  
  // ============================================
  // ROT - EL & VVS
  // ============================================
  {
    jobType: 'elinstallation',
    category: 'rot',
    timePerUnit: {
      unit: 'styck',
      min: 1,
      typical: 1.5,
      max: 2
    },
    hourlyRate: {
      budget: 750,
      standard: 850,
      premium: 1000
    },
    materialCostPerUnit: {
      min: 200,
      typical: 400,
      max: 800
    },
    warnings: [
      'Certifierad elektriker MÅSTE användas',
      'Installation i betongväggar tar längre tid'
    ],
    assumptions: [
      'Per uttag/strömbrytare',
      'Normal installation (ej bakom panel)'
    ],
    source: 'Elinstallatörsförbundet - 2025',
    lastUpdated: '2025-11-02'
  },
  {
    jobType: 'vvs_installation',
    category: 'rot',
    timePerUnit: {
      unit: 'styck',
      min: 2,
      typical: 3,
      max: 5
    },
    hourlyRate: {
      budget: 800,
      standard: 900,
      premium: 1100
    },
    materialCostPerUnit: {
      min: 500,
      typical: 1500,
      max: 5000
    },
    warnings: [
      'Certifierad VVS-montör MÅSTE användas',
      'Gamla rör kan behöva bytas ut'
    ],
    assumptions: [
      'Per enhet (WC, handfat, dusch)',
      'Normal installation'
    ],
    source: 'VVS-förbundet - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // ROT - GOLV & TAK
  // ============================================
  {
    jobType: 'golvlaggning',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.5,
      typical: 0.7,
      max: 1.0
    },
    hourlyRate: {
      budget: 600,
      standard: 750,
      premium: 900
    },
    materialCostPerUnit: {
      min: 200,
      typical: 400,
      max: 800
    },
    warnings: [
      'Ojämnt undergolv kräver utjämning (+30-50% tid)',
      'Klinker tar längre tid än laminat'
    ],
    assumptions: [
      'Inkluderar underlagsmatta och trösklar',
      'Laminat eller klinkergolv'
    ],
    source: 'Byggfakta.se - 2025',
    lastUpdated: '2025-11-02'
  },
  {
    jobType: 'taklagger',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.4,
      typical: 0.6,
      max: 1.0
    },
    hourlyRate: {
      budget: 650,
      standard: 800,
      premium: 1000
    },
    materialCostPerUnit: {
      min: 150,
      typical: 300,
      max: 600
    },
    warnings: [
      'Fallskydd krävs över 3m höjd',
      'Brant tak (>30°) tar längre tid'
    ],
    assumptions: [
      'Tegeltak eller betongpannor',
      'Inkluderar underlagspapp'
    ],
    source: 'Takläggareförbundet - 2025',
    lastUpdated: '2025-11-02'
  },
  
  // ============================================
  // ROT - PARKETTLÄGGNING MOMENT-SPECIFIKA STANDARDER
  // ============================================
  {
    jobType: 'underlagsarbete',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.15,     // Lätt underlagsarbete (jämnt golv)
      typical: 0.25, // Normal utjämning
      max: 0.40      // Mycket utjämning (ojämnt golv)
    },
    hourlyRate: {
      budget: 600,
      standard: 750,
      premium: 900
    },
    materialCostPerUnit: {
      min: 30,
      typical: 50,
      max: 100
    },
    warnings: [
      'Mycket ojämna golv kräver mer tid',
      'Fuktisolering kan behövas i källare'
    ],
    assumptions: [
      'Utjämning av undergolv',
      'Plastfolie och underlagsmatta',
      'Normal nivåskillnad (<5mm)'
    ],
    source: 'Byggfakta 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'parkett_laggning',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.5,      // Snabb läggning (klickparkett)
      typical: 0.8,  // Normal läggning
      max: 1.3       // Komplicerad (mönster, trappor)
    },
    hourlyRate: {
      budget: 600,
      standard: 750,
      premium: 900
    },
    materialCostPerUnit: {
      min: 200,
      typical: 400,
      max: 800
    },
    warnings: [
      'Komplicerade mönster ökar tiden med 50%',
      'Trappor och dörrtrösklar tar extra tid'
    ],
    assumptions: [
      'Klickparkett eller limmat',
      'Rak läggning (ej mönster)',
      'Normal rumsstorlek'
    ],
    source: 'Byggfakta 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'slipning',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.15,     // Lätt slipning (nylagt)
      typical: 0.25, // Normal slipning
      max: 0.40      // Tung slipning (gammalt golv)
    },
    hourlyRate: {
      budget: 600,
      standard: 750,
      premium: 900
    },
    materialCostPerUnit: {
      min: 10,
      typical: 20,
      max: 40
    },
    warnings: [
      'Gammalt golv med djupa spår tar längre tid',
      'Dammsugning måste göras mellan slipningar'
    ],
    assumptions: [
      '2-3 slipningar med olika kornstorlekar',
      'Dammfri slipning',
      'Normal slitning'
    ],
    source: 'Byggfakta 2025',
    lastUpdated: '2025-11-04'
  },
  {
    jobType: 'lackering',
    category: 'rot',
    timePerUnit: {
      unit: 'kvm',
      min: 0.15,     // Snabb lackering
      typical: 0.25, // Normal lackering
      max: 0.35      // Noggrann lackering (flera lager)
    },
    hourlyRate: {
      budget: 600,
      standard: 750,
      premium: 900
    },
    materialCostPerUnit: {
      min: 30,
      typical: 50,
      max: 100
    },
    warnings: [
      'Varje lager måste torka 4-6h',
      'Minst 2 lager rekommenderas'
    ],
    assumptions: [
      '2 lager golvlack',
      'Normal torktid',
      'Standard lack (ej oljning)'
    ],
    source: 'Byggfakta 2025',
    lastUpdated: '2025-11-04'
  }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Hitta branschstandard baserat på jobbtyp
 * 
 * FAS 3: DOKUMENTATION
 * STEG 1 behövs endast för jobbtyper med många delmoment och moment-specifika standarder.
 * Exempel: badrum, kök, målning, fasad har separata standarder för varje delmoment.
 * Generella jobbtyper (städning, gräsklippning etc) fungerar automatiskt med STEG 2/3.
 */
/**
 * Find industry standard for a job description.
 * 
 * THREE-STEP PROCESS:
 * STEG 1: Context-specific matching (only needed for job types with many sub-components like bathroom/kitchen)
 * STEG 2: Exact matching by keywords
 * STEG 3: Alias matching for variations
 * 
 * When is STEG 1 needed?
 * - Job types with many sub-components (e.g., bathroom: kakel_vagg, kakel_golv, el_badrum)
 * - When work items need context to select the right sub-standard
 * - New job types work automatically with STEG 2/3 unless they have sub-components
 */
// FIX-HOURS-V5: Token-baserad matchning för att undvika substring-problem
function hasWord(text: string, word: string): boolean {
  if (!text || !word) return false;
  const pattern = new RegExp(`\\b${word}\\b`, 'i');
  return pattern.test(text);
}

export function findStandard(
  jobDescription: string,
  context?: { jobType?: string; category?: string }
): JobStandard | null {
  console.log('🔍 findStandard searching for:', jobDescription, 'with context:', context);
  const lower = jobDescription.toLowerCase();
  
  // FAS 1.2: Logga inkommande sökning för debugging
  console.log(`🔍 findStandard: Söker standard för "${jobDescription}"${context?.jobType ? ` (kontext: ${context.jobType})` : ''}`);
  
  // STEG 1: Om kontext finns, prioritera moment-specifika standarder
  if (context?.jobType) {
    const contextType = context.jobType.toLowerCase();
    
    // Badrumsmoment - prioritera moment-specifika standarder
    if (contextType.includes('badrum')) {
      if (lower.includes('rivning') || lower.includes('demonter')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'rivning_badrum') || null;
      }
      if (lower.includes('vvs') || lower.includes('rör')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'vvs_badrum') || null;
      }
      
      // FIX-HOURS-V5: El - ENDAST om "el" som ord nämns utan kakel/klinker
      if ((hasWord(lower, 'el-installation') || hasWord(lower, 'elinstallation') || hasWord(lower, 'el')) && 
          !hasWord(lower, 'kakel') && !hasWord(lower, 'klinker')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'el_badrum') || null;
      }
      
      // FIX-HOURS-V5: Kakel - matcha kakelsättning, kakel vägg (men inte om "el" som separat ord finns)
      if ((hasWord(lower, 'kakel') || hasWord(lower, 'kakelsättning')) && 
          !hasWord(lower, 'el-installation')) {
        // Om explicit "vägg" nämns eller "kakel och klinker" (kommer delas upp tidigare)
        if (lower.includes('vägg') || lower.includes('och')) {
          return INDUSTRY_STANDARDS.find(s => s.jobType === 'kakel_vagg') || null;
        }
        // Annars, default till kakel_vagg för badrum
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'kakel_vagg') || null;
      }
      
      // FIX-HOURS-V5: Klinker - matcha endast när kakel INTE nämns samtidigt
      if (hasWord(lower, 'klinker') && !hasWord(lower, 'kakel')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'klinker_golv') || null;
      }
      
      // Matchning för golv (men inte golvvärme, och inte om kakel nämnts)
      if (lower.includes('golv') && !lower.includes('golvvärme') && !lower.includes('kakel')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'klinker_golv') || null;
      }
    }
    
    // Köksmoment
    if (contextType.includes('kök')) {
      if (lower.includes('rivning') || lower.includes('demonter')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'rivning_kok') || null;
      }
      if (lower.includes('vvs') || lower.includes('rör') || lower.includes('diskho')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'vvs_kok') || null;
      }
      if (lower.includes('el')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'el_kok') || null;
      }
      if (lower.includes('kakel') || lower.includes('backsplash')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'kakel_kok') || null;
      }
      if (lower.includes('skåp') || lower.includes('monter') || lower.includes('bänk')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'skåp_montering') || null;
      }
    }
    
    // Målningsmoment
    if (contextType.includes('måla') || contextType.includes('målning')) {
      if (lower.includes('spackling') || lower.includes('spackla') || lower.includes('slipning')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'spackling_sliping') || null;
      }
      if (lower.includes('grundning') || lower.includes('grund')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'grundning') || null;
      }
      if (lower.includes('första') || lower.includes('1 lager')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'malning_1_lager') || null;
      }
      if (lower.includes('andra') || lower.includes('2 lager') || lower.includes('slut')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'malning_2_lager') || null;
      }
    }
    
    // Fasadmoment
    if (contextType.includes('fasad')) {
      if (lower.includes('rengör') || lower.includes('tvätt') || lower.includes('högtryck')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'fasad_rengoring') || null;
      }
      if (lower.includes('förberedelse') || lower.includes('spackling')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'fasad_forberedelse') || null;
      }
      if (lower.includes('målning') || lower.includes('måla')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'fasad_malning') || null;
      }
      if (lower.includes('ställning')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'stallning') || null;
      }
    }
    
    // Trädgårdsmoment
    if (contextType.includes('trädgård')) {
      if (lower.includes('plantering') || lower.includes('plantera')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'plantering') || null;
      }
      if (lower.includes('markberedning') || lower.includes('gräv')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'markberedning') || null;
      }
    }
    
    // Parkettmoment
    if (contextType.includes('parkett') || contextType.includes('golv')) {
      if (lower.includes('underlag') || lower.includes('utjämn')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'underlagsarbete') || null;
      }
      if (lower.includes('läggning') || lower.includes('lägg')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'parkett_laggning') || null;
      }
      if (lower.includes('slipning') || lower.includes('slipa')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'slipning') || null;
      }
      if (lower.includes('lackering') || lower.includes('lacka')) {
        return INDUSTRY_STANDARDS.find(s => s.jobType === 'lackering') || null;
      }
    }
  }
  
  // STEG 2: Try exact match
  for (const standard of INDUSTRY_STANDARDS) {
    if (lower.includes(standard.jobType.toLowerCase())) {
      console.log('✅ Found exact match:', standard.jobType);
      return standard;
    }
  }
  
  // STEG 3: Try alias matching (FAS 3: Kontextmedvetna alias för el/kakel/klinker)
  // Note: Removed problematic 'el' → 'elinstallation' (doesn't exist in standards)
  // These aliases are now context-aware when used with STEG 1
  const aliases: Record<string, string> = {
    'städa': 'hemstadning',
    'flytta': 'flyttstadning',
    'putsafönster': 'fonsterputs',
    'klippagräs': 'grasklippning',
    'klippahäck': 'hakkklippning',
    'fällaträd': 'tradfall',
    'kök': 'kokrenovering',
    'måla': 'malning_inomhus',
    'fasad': 'malning_fasad',
    'vvs': 'vvs_installation',
    'golv': 'golvlaggning',
    'tak': 'taklagger'
  };
  
  for (const [alias, jobType] of Object.entries(aliases)) {
    if (lower.includes(alias)) {
      const result = INDUSTRY_STANDARDS.find(s => s.jobType === jobType) || null;
      if (result) {
        // FAS 1.2: Logga när standard hittas via alias
        console.log(`✅ Hittade standard via alias "${alias}" → ${result.jobType}`);
        return result;
      }
    }
  }
  
  // FAS 1.2: Logga när ingen standard hittas
  console.warn(`❌ Ingen standard hittades för "${jobDescription}"`);
  return null;
}

/**
 * Beräkna tid baserat på branschstandard
 */
export function calculateTimeFromStandard(
  standard: JobStandard,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number },
  complexity: 'simple' | 'normal' | 'complex' = 'normal'
): number {
  let timePerUnit = standard.timePerUnit.typical;
  
  // Justera baserat på komplexitet
  if (complexity === 'simple') {
    timePerUnit = standard.timePerUnit.min;
  } else if (complexity === 'complex') {
    timePerUnit = standard.timePerUnit.max;
  }
  
  // Beräkna total tid
  const unit = standard.timePerUnit.unit;
  
  if (unit === 'kvm' && measurements.area) {
    return measurements.area * timePerUnit;
  } else if (unit === 'rum' && measurements.rooms) {
    return measurements.rooms * timePerUnit;
  } else if (unit === 'styck' && measurements.quantity) {
    return measurements.quantity * timePerUnit;
  } else if (unit === 'meter' && measurements.length) {
    return measurements.length * timePerUnit;
  } else if (unit === 'timme') {
    return timePerUnit; // Fixed time
  }
  
  // Fallback
  return timePerUnit;
}

/**
 * Generera prompt-tillägg för branschstandard
 */
export function getStandardPromptAddition(
  standard: JobStandard,
  measurements: { area?: number; rooms?: number; quantity?: number; length?: number }
): string {
  const estimatedTime = calculateTimeFromStandard(standard, measurements);
  
  return `

**🎯 BRANSCHSTANDARD HITTAD: ${standard.jobType.toUpperCase()}**
- Kategori: ${standard.category === 'rot' ? 'ROT' : standard.category === 'rut' ? 'RUT' : 'Ingen avdragsrätt'}
- Typisk tid: ${standard.timePerUnit.typical} ${standard.timePerUnit.unit}
- Rekommenderat timpris: ${standard.hourlyRate.standard} kr/h (budget: ${standard.hourlyRate.budget}, premium: ${standard.hourlyRate.premium})
- Estimerad total tid för detta jobb: ~${estimatedTime.toFixed(1)} timmar

${standard.materialCostPerUnit ? `**Material per ${standard.timePerUnit.unit}:**
- Budget: ${standard.materialCostPerUnit.min} kr
- Standard: ${standard.materialCostPerUnit.typical} kr
- Premium: ${standard.materialCostPerUnit.max} kr
` : ''}
**⚠️ VARNINGAR:**
${standard.warnings.map(w => `- ${w}`).join('\n')}

**📋 ANTAGANDEN:**
${standard.assumptions.map(a => `- ${a}`).join('\n')}

**🔒 VIKTIGT:**
1. Använd denna branschstandard som GRUND - avvikelser MÅSTE motiveras i reasoning-fältet!
2. Justera baserat på:
   - Användarens tidigare timpriser (Layer 1)
   - Specifika omständigheter i beskrivningen
   - Komplexitet (enkel/normal/komplex)
3. Om du avviker mer än 30% från standarden, förklara VARFÖR i reasoning!

**Källa:** ${standard.source} (uppdaterad: ${standard.lastUpdated})
`;
}
