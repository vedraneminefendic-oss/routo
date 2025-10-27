export const PAINTING_REQUIREMENTS = {
  minimumWorkItems: [
    {
      name: 'Förberedelser och skydd',
      minHours: 2,
      description: 'Skydda golv, möbler och maskera'
    },
    {
      name: 'Spackling och slipning',
      minHours: 2,
      description: 'Reparera hål och ojämnheter'
    },
    {
      name: 'Grundmålning',
      minHours: 3,
      description: 'Första strykning med grundfärg'
    },
    {
      name: 'Slutstrykningar',
      minHours: 4,
      description: '1-2 slutstrykningar'
    },
    {
      name: 'Städning och efterarbete',
      minHours: 2,
      description: 'Ta bort skydd och städa'
    }
  ],
  
  minimumMaterials: [
    { name: 'Färg', minQuantity: 'perArea', multiplier: 0.15 }, // 6-7 sqm per liter
    { name: 'Spackel', minQuantity: 1 },
    { name: 'Maskering och skyddsduk', minQuantity: 1 },
    { name: 'Grundfärg (vid behov)', minQuantity: 'perArea', multiplier: 0.1 }
  ],
  
  minimumCostPerSqm: 150,
  recommendedCostPerSqm: 300,
  
  warnings: [
    'Priset varierar kraftigt beroende på antal strykningar',
    'Mörka färger kan kräva extra strykningar',
    'Takmålning kostar mer än väggmålning'
  ]
};

export function isPaintingProject(description: string, projectType?: string): boolean {
  const desc = description.toLowerCase();
  return (
    projectType === 'painting' ||
    projectType === 'målning' ||
    desc.includes('måla') ||
    desc.includes('målning')
  );
}

export function getPaintingPromptAddition(area: number): string {
  return `

🎨 KRITISKT: Detta är ett MÅLNINGSJOBB. Du MÅSTE inkludera:

OBLIGATORISKA ARBETSMOMENT:
${PAINTING_REQUIREMENTS.minimumWorkItems.map(item => 
  `- ${item.name}: ${item.description} (minst ${item.minHours}h)`
).join('\n')}

MATERIAL SOM ALLTID MÅSTE FINNAS MED:
${PAINTING_REQUIREMENTS.minimumMaterials.map(m => `- ${m.name}`).join('\n')}

KOSTNADSKONTROLL:
- Minimum: ${PAINTING_REQUIREMENTS.minimumCostPerSqm} kr/kvm
- Rekommenderat: ${PAINTING_REQUIREMENTS.recommendedCostPerSqm} kr/kvm
- För ${area} kvm väggyta, bör totalen vara minst ${Math.round(area * PAINTING_REQUIREMENTS.minimumCostPerSqm)} kr

VIKTIGA FAKTORER:
${PAINTING_REQUIREMENTS.warnings.map(w => `⚠️ ${w}`).join('\n')}
`;
}
