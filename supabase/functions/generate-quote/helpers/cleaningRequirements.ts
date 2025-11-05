/**
 * STÄDNING - KRAV OCH STANDARDS
 */

export const CLEANING_REQUIREMENTS = {
  minimumWorkItems: [
    { name: 'Grundstädning', minHours: 3, description: 'Dammsugning, mopping, dammtorkning av alla ytor' },
    { name: 'Sanitetsutrymmen', minHours: 1.5, description: 'Toaletter, badrum, handfat - skura och desinficera' },
    { name: 'Fönsterputs', minHours: 1, description: 'Invändig och utvändig fönsterputsning', optional: true },
  ],
  
  minimumMaterials: [
    { name: 'Städmaterial och rengöringsmedel', minQuantity: 1, estimatedCost: 500 },
  ],
  
  // Priser baserat på databas: avg 7371 kr för 9.9h = ~745 kr/h, 7371/area
  minimumCostPerSqm: 40,      // Minimum 40 kr/kvm (vanlig städning)
  recommendedCostPerSqm: 80,  // Rekommenderat 80 kr/kvm (flyttstädning)
  minimumHourlyRate: 500,     // Minimum timpris
  recommendedHourlyRate: 750,  // Rekommenderat timpris
  
  warnings: [
    'Priset varierar beroende på smutsgrad och typ av städning',
    'Flyttstädning kostar mer än vanlig städning (50-100% påslag)',
    'Fönsterputs kan vara ett separat tillägg',
  ],
  
  timeEstimates: {
    // Baserat på area
    basicCleaning: { unit: 'kvm', timePerUnit: 0.15 }, // 0.15h per kvm
    deepCleaning: { unit: 'kvm', timePerUnit: 0.25 },  // 0.25h per kvm (flyttstäd)
    windowCleaning: { unit: 'fönster', timePerUnit: 0.3 }, // 0.3h per fönster
  }
};

export function isCleaningProject(description: string, projectType?: string): boolean {
  const desc = description.toLowerCase();
  const type = (projectType || '').toLowerCase();
  
  return (
    type === 'cleaning' ||
    type === 'städning' ||
    type === 'flyttstädning' ||
    desc.includes('städ') ||
    desc.includes('flyttstäd') ||
    desc.includes('rengör')
  );
}

export function getCleaningPromptAddition(area: number): string {
  const minCost = area * CLEANING_REQUIREMENTS.minimumCostPerSqm;
  const recCost = area * CLEANING_REQUIREMENTS.recommendedCostPerSqm;
  
  return `

🧹 STÄDJOBB - Obligatoriska minimikrav:

ARBETSMOMENT (minst ${area > 0 ? Math.ceil(area * 0.15) : 3}h totalt för ${area}kvm):
${CLEANING_REQUIREMENTS.minimumWorkItems.map(item => 
  `- ${item.name}: Minst ${item.minHours}h (${item.description})${item.optional ? ' [VALFRITT]' : ' [OBLIGATORISKT]'}`
).join('\n')}

MATERIAL:
${CLEANING_REQUIREMENTS.minimumMaterials.map(m => 
  `- ${m.name}: ${m.estimatedCost} kr`
).join('\n')}

PRISKRAV:
- Minimum totalpris: ${minCost} kr (${CLEANING_REQUIREMENTS.minimumCostPerSqm} kr/kvm)
- Rekommenderat: ${recCost} kr (${CLEANING_REQUIREMENTS.recommendedCostPerSqm} kr/kvm för flyttstäd)
- Minimum timpris: ${CLEANING_REQUIREMENTS.minimumHourlyRate} kr/h

VARNINGAR:
${CLEANING_REQUIREMENTS.warnings.map(w => `⚠️ ${w}`).join('\n')}

KRITISKT: Om totalpriset blir under ${minCost} kr kommer offerten att BLOCKERAS.
`;
}
