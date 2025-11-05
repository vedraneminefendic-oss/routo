/**
 * EL-INSTALLATION - KRAV OCH STANDARDS
 */

export const ELECTRICAL_REQUIREMENTS = {
  minimumWorkItems: [
    { name: 'Planering och felsökning', minHours: 2, description: 'Planera arbete och kontrollera befintlig installation' },
    { name: 'Installation', minHours: 4, description: 'Dra kablar, montera uttag/strömbrytare' },
    { name: 'Inkoppling och testning', minHours: 1.5, description: 'Koppla in i tavla och funktionstest' },
  ],
  
  minimumMaterials: [
    { name: 'Kablar och ledningar', minQuantity: 1, estimatedCost: 1500 },
    { name: 'Uttag och strömbrytare', minQuantity: 1, estimatedCost: 800 },
    { name: 'Kopplingsdon och säkringar', minQuantity: 1, estimatedCost: 500 },
  ],
  
  // Baserat på databas: avg 70083 kr för 60.3h = ~1162 kr/h
  minimumHourlyRate: 800,        // Minimum 800 kr/h (behörig elektriker)
  recommendedHourlyRate: 1100,   // Rekommenderat 1100 kr/h
  minimumTotalCost: 5000,        // Minimum 5000 kr totalt
  
  warnings: [
    'Endast behöriga elektriker får utföra elinstallationer',
    'Installation måste kontrollbesiktigas av auktoriserad elektriker',
    'Priset varierar beroende på omfattning och svårighetsgrad',
    'Material kan variera kraftigt beroende på kvalitet och märke',
    'Extraarbete kan tillkomma vid oväntade problem med befintlig installation',
  ],
  
  timeEstimates: {
    newOutlet: { unit: 'uttag', timePerUnit: 1.5 },      // 1.5h per uttag
    newLight: { unit: 'armatur', timePerUnit: 1.0 },     // 1h per armatur
    panel: { unit: 'tavla', timePerUnit: 8 },            // 8h för byte av tavla
  }
};

export function isElectricalProject(description: string, projectType?: string): boolean {
  const desc = description.toLowerCase();
  const type = (projectType || '').toLowerCase();
  
  return (
    type === 'electrical' ||
    type === 'el' ||
    type === 'elinstallation' ||
    desc.includes('el') ||
    desc.includes('elektr') ||
    desc.includes('uttag') ||
    desc.includes('belysning') ||
    desc.includes('tavla')
  );
}

export function getElectricalPromptAddition(outlets: number): string {
  const estimatedHours = Math.max(outlets * 1.5, 8); // Minst 8h för el-jobb
  const minCost = Math.max(estimatedHours * ELECTRICAL_REQUIREMENTS.minimumHourlyRate, ELECTRICAL_REQUIREMENTS.minimumTotalCost);
  
  return `

⚡ EL-INSTALLATION - Obligatoriska minimikrav:

ARBETSMOMENT (minst ${estimatedHours}h totalt):
${ELECTRICAL_REQUIREMENTS.minimumWorkItems.map(item => 
  `- ${item.name}: Minst ${item.minHours}h (${item.description}) [OBLIGATORISKT]`
).join('\n')}

MATERIAL:
${ELECTRICAL_REQUIREMENTS.minimumMaterials.map(m => 
  `- ${m.name}: ~${m.estimatedCost} kr`
).join('\n')}

PRISKRAV:
- Minimum totalpris: ${minCost.toFixed(0)} kr
- Minimum timpris: ${ELECTRICAL_REQUIREMENTS.minimumHourlyRate} kr/h (behörig elektriker)
- Rekommenderat timpris: ${ELECTRICAL_REQUIREMENTS.recommendedHourlyRate} kr/h

VARNINGAR:
${ELECTRICAL_REQUIREMENTS.warnings.map(w => `⚠️ ${w}`).join('\n')}

KRITISKT: Om totalpriset blir under ${minCost.toFixed(0)} kr kommer offerten att BLOCKERAS.
`;
}
