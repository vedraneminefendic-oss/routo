// ==========================================
// BATHROOM RENOVATION REQUIREMENTS
// ==========================================

export const BATHROOM_REQUIREMENTS = {
  minimumWorkItems: [
    {
      name: 'Rivning befintligt badrum',
      minHours: 8,
      description: 'Demontering av alla ytskikt, inredning och installationer'
    },
    {
      name: 'VVS-installation',
      minHours: 12,
      description: 'Byte av rör, kopplingar, ventiler, golvbrunn, installera dusch/toalett/tvättställ'
    },
    {
      name: 'El-installation våtrum',
      minHours: 10,
      description: 'Jordfelsbrytare, IP44-armaturer, golvvärmekabel, fläktinstallation'
    },
    {
      name: 'Tätskiktsarbete',
      minHours: 8,
      description: 'Applicering av tätskikt på golv och väggar enligt branschregler'
    },
    {
      name: 'Kakel och klinkersättning',
      minHours: 16,
      description: 'Kakling av väggar och klinker på golv'
    },
    {
      name: 'Golvvärmemontage',
      minHours: 6,
      description: 'Läggning av golvvärmematta och installation av termostat'
    },
    {
      name: 'Ventilationsinstallation',
      minHours: 3,
      description: 'Montering av badrumsfläkt med timer och fuktavkännare'
    },
    {
      name: 'Slutbesiktning och städning',
      minHours: 4,
      description: 'Kontroll av täthet, fuktmätning, certifikat, slutstädning'
    }
  ],
  
  minimumMaterials: [
    { name: 'Våtrumsskivor', minQuantity: 'perArea', multiplier: 3.5 },
    { name: 'Tätskiktsduk/-vätska', minQuantity: 'perArea', multiplier: 1.2 },
    { name: 'Kakel vägg', minQuantity: 'perArea', multiplier: 2.5 },
    { name: 'Klinker golv', minQuantity: 'perArea', multiplier: 1.1 },
    { name: 'Golvbrunn', minQuantity: 1 },
    { name: 'Duschblandare termostat', minQuantity: 1 },
    { name: 'Duschset', minQuantity: 1 },
    { name: 'WC-stol', minQuantity: 1 },
    { name: 'Tvättställ', minQuantity: 1 },
    { name: 'Tvättställsblandare', minQuantity: 1 },
    { name: 'Golvvärmematta', minQuantity: 'perArea', multiplier: 1.0 },
    { name: 'Termostat golvvärme', minQuantity: 1 },
    { name: 'Badrumsfläkt', minQuantity: 1 },
    { name: 'IP44 taklampa', minQuantity: 2 },
    { name: 'Jordfelsbrytare', minQuantity: 1 },
    { name: 'VVS-rör och kopplingar', minQuantity: 1 },
    { name: 'Elkabel för våtrum', minQuantity: 1 }
  ],
  
  minimumCostPerSqm: 18000,
  recommendedCostPerSqm: 25000,
  
  warnings: [
    'Fuktmätning före och efter är obligatorisk',
    'Alla el-installationer i våtrum måste ha IP44-klassning',
    'Jordfelsbrytare är obligatoriskt enligt el-säkerhetsverket',
    'Tätskikt minst 20cm upp på väggar vid dusch',
    'Ventilation måste vara minst 25 l/s enligt BBR',
    'Spara alla certifikat för försäkringsbolag'
  ]
};

export function isBathroomProject(description: string, projectType?: string): boolean {
  const bathroomKeywords = ['badrum', 'bathroom', 'våtrum', 'dusch', 'toalett', 'wc'];
  const renovationKeywords = ['renovera', 'renovering', 'totalrenovera', 'bygga om', 'nytt'];
  
  const descLower = description.toLowerCase();
  const hasBathroomKeyword = bathroomKeywords.some(kw => descLower.includes(kw));
  const hasRenovationKeyword = renovationKeywords.some(kw => descLower.includes(kw));
  
  return (projectType === 'bathroom' || hasBathroomKeyword) && hasRenovationKeyword;
}

export function getBathroomPromptAddition(area: number): string {
  return `
  
⚠️ KRITISKT: Detta är en BADRUMSRENOVERING - följ dessa regler NOGGRANT:

OBLIGATORISKA ARBETSMOMENT (inkludera ALLA):
${BATHROOM_REQUIREMENTS.minimumWorkItems.map(item => 
  `- ${item.name}: ${item.description} (minst ${item.minHours}h)`
).join('\n')}

OBLIGATORISKT MATERIAL (måste finnas med):
${BATHROOM_REQUIREMENTS.minimumMaterials.map(m => `- ${m.name}`).join('\n')}

PRISKONTROLL:
- Minimum totalpris: ${Math.round(area * BATHROOM_REQUIREMENTS.minimumCostPerSqm)} SEK (${BATHROOM_REQUIREMENTS.minimumCostPerSqm} kr/kvm × ${area} kvm)
- Rekommenderat pris: ${Math.round(area * BATHROOM_REQUIREMENTS.recommendedCostPerSqm)} SEK (${BATHROOM_REQUIREMENTS.recommendedCostPerSqm} kr/kvm × ${area} kvm)
- Priset MÅSTE ligga mellan dessa värden!

VIKTIGA SÄKERHETSVARNINGAR att inkludera i offerten:
${BATHROOM_REQUIREMENTS.warnings.map(w => `⚠️ ${w}`).join('\n')}

OM OFFERTEN BLIR FÖR BILLIG:
- Dubbelkolla att ALLA arbetsmoment finns med
- Se till att timmar per moment är realistiska (totalt minst 50-70h för komplett badrum)
- Kontrollera att alla material finns med
- Använd marknadspriser för material (golvbrunn 800-1200 kr, duschset 1500-3000 kr, etc)
`;
}
