export const KITCHEN_REQUIREMENTS = {
  minimumWorkItems: [
    {
      name: 'Rivning befintligt kök',
      minHours: 10,
      description: 'Demontering av skåp, bänkskivor och vitvaror'
    },
    {
      name: 'VVS-installation',
      minHours: 8,
      description: 'Installation av diskho, diskmaskin och andra VVS-anslutningar'
    },
    {
      name: 'El-installation',
      minHours: 12,
      description: 'Nya uttag, spisplatta, ugn, köksfläkt'
    },
    {
      name: 'Montering skåp och bänkskiva',
      minHours: 16,
      description: 'Montering av alla skåp, lådor och bänkskivor'
    },
    {
      name: 'Väggbeklädning',
      minHours: 8,
      description: 'Kakel eller målning av väggar'
    },
    {
      name: 'Slutbesiktning och städning',
      minHours: 4,
      description: 'Kontroll av funktion och slutstädning'
    }
  ],
  
  minimumMaterials: [
    { name: 'Köksskåp', minQuantity: 5 },
    { name: 'Bänkskiva', minQuantity: 1 },
    { name: 'Diskho', minQuantity: 1 },
    { name: 'Diskblandare', minQuantity: 1 },
    { name: 'Köksfläkt', minQuantity: 1 },
    { name: 'Eluttag', minQuantity: 5 },
    { name: 'Kakel eller väggfärg', minQuantity: 1 }
  ],
  
  minimumCostPerSqm: 12000,
  recommendedCostPerSqm: 18000,
  
  warnings: [
    'El-installationer måste utföras av behörig elektriker',
    'VVS-arbete ska utföras enligt branschregler',
    'Alla vitvaror måste vara godkända för installation'
  ]
};

export function isKitchenProject(description: string, projectType?: string): boolean {
  const desc = description.toLowerCase();
  return (
    projectType === 'kitchen' ||
    projectType === 'kök' ||
    (desc.includes('kök') && (desc.includes('renovera') || desc.includes('renovering') || desc.includes('nytt')))
  );
}

export function getKitchenPromptAddition(area: number): string {
  return `

🍳 KRITISKT: Detta är en KÖKSRENOVERING. Du MÅSTE inkludera:

OBLIGATORISKA ARBETSMOMENT:
${KITCHEN_REQUIREMENTS.minimumWorkItems.map(item => 
  `- ${item.name}: ${item.description} (minst ${item.minHours}h)`
).join('\n')}

MATERIAL SOM ALLTID MÅSTE FINNAS MED:
${KITCHEN_REQUIREMENTS.minimumMaterials.map(m => `- ${m.name}`).join('\n')}

KOSTNADSKONTROLL:
- Minimum: ${KITCHEN_REQUIREMENTS.minimumCostPerSqm} kr/kvm
- Rekommenderat: ${KITCHEN_REQUIREMENTS.recommendedCostPerSqm} kr/kvm
- För ${area} kvm, bör totalen vara minst ${Math.round(area * KITCHEN_REQUIREMENTS.minimumCostPerSqm)} kr

SÄKERHETSVARNINGAR:
${KITCHEN_REQUIREMENTS.warnings.map(w => `⚠️ ${w}`).join('\n')}
`;
}
