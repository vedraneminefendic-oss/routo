/**
 * TRÄDGÅRD/TRÄDFÄLLNING - KRAV OCH STANDARDS
 */

export const GARDENING_REQUIREMENTS = {
  treeFelling: {
    minimumWorkItems: [
      { name: 'Trädfällning', minHours: 3, description: 'Fällning med motorsåg och säkerhetsutrustning' },
      { name: 'Kapning och bortforsling', minHours: 2, description: 'Kapa träd i sektioner och forsla bort' },
      { name: 'Stubbfräsning', minHours: 1.5, description: 'Fräsa ned stubbe under marknivå', optional: true },
    ],
    
    minimumMaterials: [
      { name: 'Bränsle och smörjmedel', minQuantity: 1, estimatedCost: 300 },
    ],
    
    minimumEquipment: [
      { name: 'Motorsåg', estimatedCost: 800 },
      { name: 'Säkerhetsutrustning', estimatedCost: 500 },
    ],
    
    // Baserat på databas: avg 17544 kr för 15.1h = ~1162 kr/h
    minimumCostPerTree: 4000,      // Minimum 4000 kr per träd
    recommendedCostPerTree: 8000,  // Rekommenderat 8000 kr per träd (medelhögt)
    minimumHourlyRate: 800,        // Minimum timpris (farligt arbete)
    recommendedHourlyRate: 1200,   // Rekommenderat timpris
    
    warnings: [
      'Priset beror på trädhöjd, omkrets och omgivning',
      'Extra kostnad för svåråtkomliga träd eller nära byggnader',
      'Krävs fallriktningsbedömning och säkerhetsplan',
      'Försäkring och F-skatt krävs för professionell arborist',
      'Stubbfräsning är ofta ett separat tillägg',
    ],
  }
};

export function isGardeningProject(description: string, projectType?: string): boolean {
  const desc = description.toLowerCase();
  const type = (projectType || '').toLowerCase();
  
  return (
    type === 'gardening' ||
    type === 'trädgård' ||
    type === 'trädfällning' ||
    desc.includes('träd') ||
    desc.includes('fäll') ||
    desc.includes('trädgård') ||
    desc.includes('gran')
  );
}

export function getGardeningPromptAddition(quantity: number): string {
  const reqs = GARDENING_REQUIREMENTS.treeFelling;
  const minCost = quantity * reqs.minimumCostPerTree;
  const recCost = quantity * reqs.recommendedCostPerTree;
  
  return `

🌲 TRÄDFÄLLNING - Obligatoriska minimikrav:

ARBETSMOMENT (minst ${quantity * 5}h totalt för ${quantity} träd):
${reqs.minimumWorkItems.map(item => 
  `- ${item.name}: Minst ${item.minHours}h per träd (${item.description})${item.optional ? ' [VALFRITT]' : ' [OBLIGATORISKT]'}`
).join('\n')}

MATERIAL:
${reqs.minimumMaterials.map(m => 
  `- ${m.name}: ~${m.estimatedCost} kr`
).join('\n')}

UTRUSTNING:
${reqs.minimumEquipment.map(e => 
  `- ${e.name}: ~${e.estimatedCost} kr/dag hyra eller inkluderat`
).join('\n')}

PRISKRAV:
- Minimum totalpris: ${minCost} kr (${reqs.minimumCostPerTree} kr/träd)
- Rekommenderat: ${recCost} kr (${reqs.recommendedCostPerTree} kr/träd)
- Minimum timpris: ${reqs.minimumHourlyRate} kr/h (farligt arbete)

VARNINGAR:
${reqs.warnings.map(w => `⚠️ ${w}`).join('\n')}

KRITISKT: Om totalpriset blir under ${minCost} kr kommer offerten att BLOCKERAS.
`;
}
