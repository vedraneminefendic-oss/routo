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

🚨🚨🚨 KRITISKT - BADRUMSRENOVERING - LÄS DETTA FÖRST! 🚨🚨🚨

Detta är en TOTALRENOVERING av ett badrum ${area} kvm.

DU MÅSTE inkludera ALLA dessa arbetsmoment i offerten (inga undantag):

1. ✅ Rivning befintligt badrum (minst 8h)
2. ✅ VVS-installation - Byte av rör, kopplingar, ventiler, golvbrunn (minst 12h)
3. ✅ El-installation våtrum - Jordfelsbrytare, IP44-armaturer, golvvärmekabel (minst 10h)
4. ✅ Tätskiktsarbete - Applicering enligt branschregler (minst 8h)
5. ✅ Kakel och klinkersättning (minst 16h)
6. ✅ Golvvärmemontage (minst 6h)
7. ✅ Ventilationsinstallation (minst 3h)
8. ✅ Slutbesiktning och städning (minst 4h)

TOTALT MINIMUM: 67 timmar arbete

OBLIGATORISKT MATERIAL:
${BATHROOM_REQUIREMENTS.minimumMaterials.map(m => `✅ ${m.name}`).join('\n')}

PRISKONTROLL - ABSOLUT MINIMUM:
- Minimum totalpris: ${Math.round(area * BATHROOM_REQUIREMENTS.minimumCostPerSqm)} SEK
- Rekommenderat pris: ${Math.round(area * BATHROOM_REQUIREMENTS.recommendedCostPerSqm)} SEK
- DIN OFFERT FÅR INTE VARA LÄGRE ÄN ${Math.round(area * BATHROOM_REQUIREMENTS.minimumCostPerSqm)} SEK!

⚠️ OM DU SKAPAR EN OFFERT UNDER ${Math.round(area * BATHROOM_REQUIREMENTS.minimumCostPerSqm)} SEK:
- Lägg till fler timmar på VVS (12h → 16h)
- Lägg till fler timmar på El (10h → 14h)
- Öka timpriserna till 950 kr/h för specialiserade arbeten
- Kontrollera att ALLA material finns med

SÄKERHETSVARNINGAR som MÅSTE inkluderas i assumptions:
${BATHROOM_REQUIREMENTS.warnings.map(w => `⚠️ ${w}`).join('\n')}

🚨 OM DU GLÖMMER VVS ELLER EL-INSTALLATION KOMMER OFFERTEN ATT AVVISAS! 🚨
`;
}
