// ============================================================================
// LAYERED PROMPT - FAS 0: HYBRIDMODELL (WEB → BRANSCH → USER)
// ============================================================================

import { PAINTING_REQUIREMENTS } from './paintingRequirements.ts';

interface LayeredContext {
  layer1_market: string;      // Webben (alltid 100% för nya)
  layer2_industry: string;    // Branschdata (80% vikt)
  layer3_user: string;        // User (0% → 100% efter 20+ offerter)
  userWeighting: number;      // 0-100% baserat på erfarenhet (GLOBAL)
  // NYA FÖR PUNKT 3:
  jobCategory: string;        // 'målning', 'vvs', 'el', 'övrigt'
  categoryWeighting: number;  // 0-100% för denna kategori
  categoryAvgRate: number;    // Användarens genomsnittliga timpris i kategorin
  categoryQuotes: number;     // Antal offerter i kategorin
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * FAS 0: HYBRIDMODELL - Ny prioritering
 * Lager 1 (högst): Webben/marknadsnivå (för nya användare)
 * Lager 2 (medium): Branschdata/benchmarks (validering)
 * Lager 3 (viktad): Användarens egna priser (0-100% baserat på antal offerter)
 */
export async function buildLayeredPrompt(
  userId: string,
  description: string,
  jobType: string, // NY PARAMETER för kategori-detektering
  conversationHistory: ConversationMessage[],
  measurements: any,
  supabase: any,
  liveSearchResult?: any
): Promise<LayeredContext> {
  
  console.log('🏗️ FAS 0: Building 3-layer HYBRID prompt structure...');
  
  // ============ IMPORTERA KATEGORI-DETEKTOR (PUNKT 3) ============
  const detectJobCategory = (desc: string, type?: string): string => {
    const normalized = desc.toLowerCase();
    if (type) {
      const t = type.toLowerCase();
      if (t.includes('målning') || t.includes('måla')) return 'målning';
      if (t.includes('badrum') || t.includes('våtrum')) return 'badrum';
      if (t.includes('kök')) return 'kök';
      if (t.includes('el')) return 'el';
      if (t.includes('vvs') || t.includes('rör')) return 'vvs';
      if (t.includes('trädgård') || t.includes('gräs')) return 'trädgård';
      if (t.includes('städ')) return 'städning';
      if (t.includes('golv') || t.includes('parkett')) return 'golv';
    }
    if (normalized.includes('måla') || normalized.includes('målning')) return 'målning';
    if (normalized.includes('badrum') || normalized.includes('dusch')) return 'badrum';
    if (normalized.includes('kök')) return 'kök';
    if (normalized.includes('el')) return 'el';
    if (normalized.includes('vvs') || normalized.includes('rör')) return 'vvs';
    if (normalized.includes('trädgård') || normalized.includes('gräs')) return 'trädgård';
    if (normalized.includes('städ')) return 'städning';
    return 'övrigt';
  };
  
  // ============ BERÄKNA ANVÄNDARVIKTNING (0-100%) ============
  
  const { data: userPatterns } = await supabase
    .from('user_quote_patterns')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  const totalQuotes = userPatterns?.total_quotes || 0;
  const userWeighting = Math.min(100, (totalQuotes / 20) * 100);
  const marketWeighting = 100 - userWeighting;
  
  // ============ KATEGORI-SPECIFIK VIKTNING (PUNKT 3) ============
  const jobCategory = detectJobCategory(description, jobType);
  const categoryData = userPatterns?.category_weighting?.[jobCategory];
  const categoryWeighting = categoryData?.user_weighting || 0;
  const categoryAvgRate = categoryData?.avg_rate || 0;
  const categoryQuotes = categoryData?.total_quotes || 0;
  
  console.log('📊 Weighting calculated:', {
    totalQuotes,
    globalWeighting: `${userWeighting.toFixed(0)}%`,
    category: jobCategory,
    categoryQuotes,
    categoryWeighting: `${categoryWeighting.toFixed(0)}%`,
    categoryAvgRate: categoryAvgRate || 'N/A'
  });
  
  // ============ LAGER 1: MARKNADSNIVÅ (WEBBEN - HÖGSTA PRIORITET FÖR NYA) ============
  
  const layer1_market = `
**LAGER 1: MARKNADSNIVÅ (WEBBEN - ${marketWeighting.toFixed(0)}% vikt)**

${liveSearchResult ? `
**Live-webbsökning utförd:**
- Arbetstyp: ${description}
- Tidsuppskattning: ${liveSearchResult.timeEstimate} timmar
- Prisklass: ${liveSearchResult.priceRange.min}-${liveSearchResult.priceRange.max} kr
- Timpris: ${liveSearchResult.hourlyRate} kr/h
- Källa: ${liveSearchResult.source}
- Confidence: ${liveSearchResult.confidence}
` : 'Webbaserad prisinformation från jobbdefinitioner och branschstandarder'}

**ROT/RUT-regler (från Skatteverket):**
- ROT: 30% avdrag på arbetskostnad, max 50 000 kr/år per person
  - Gäller: Renovering, ombyggnad, tillbyggnad, underhåll i BOSTAD
  - Gäller INTE: Nybyggnation, fritidshus som inte är permanentbostad
- RUT: 50% avdrag på arbetskostnad, max 75 000 kr/år per person
  - Gäller: Hushållsnära tjänster (städning, trädgård, snöröjning, flytthjälp)
  - Gäller INTE: Arbete på annans fastighet, material, trädfällning

**INSTRUKTION:** Detta är MARKNADSPRISER som ger användarna genast trovärdiga offerter.
För denna ${jobCategory}-offert: Använd ${100 - categoryWeighting}% marknadspriser + ${categoryWeighting.toFixed(0)}% användarens ${jobCategory}-priser.
${categoryQuotes > 0 ? `Användarens genomsnittliga timpris i ${jobCategory}: ${categoryAvgRate} kr/h (baserat på ${categoryQuotes} offerter)` : `Ny kategori för användaren - använd 100% marknadspriser`}

${jobCategory === 'badrum' ? `

**🚨 KRITISKT FÖR BADRUMSRENOVERING${measurements?.area ? ` (${measurements.area} kvm)` : ''}:**

För badrum ska du ALLTID dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Rivning och demontering** (jobType: 'rivning_badrum')
   - Standard: 1.5-3.5h per kvm (typical: 2.5h/kvm)
   - Timpris: 650-900 kr/h (standard: 750 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.5).toFixed(1)}h` : '- Yta saknas - använd 4 kvm som antagande (= 10h)'}

2. **VVS-installation** (jobType: 'vvs_badrum')
   - Standard: 2.0-4.0h per kvm (typical: 2.8h/kvm)
   - Timpris: 800-1100 kr/h (standard: 950 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.8).toFixed(1)}h` : '- Yta saknas - använd 4 kvm som antagande (= 11.2h)'}

3. **El-installation** (jobType: 'el_badrum')
   - Standard: 1.8-3.2h per kvm (typical: 2.5h/kvm)
   - Timpris: 850-1100 kr/h (standard: 950 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.5).toFixed(1)}h` : '- Yta saknas - använd 4 kvm som antagande (= 10h)'}

4. **Kakelsättning väggar** (jobType: 'kakel_vagg')
   - Standard: 1.5-3.0h per kvm (typical: 2.2h/kvm)
   - Timpris: 700-950 kr/h (standard: 800 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.2).toFixed(1)}h` : '- Yta saknas - använd 4 kvm som antagande (= 8.8h)'}

5. **Klinkersättning golv** (jobType: 'klinker_golv')
   - Standard: 2.0-3.5h per kvm (typical: 2.8h/kvm)
   - Timpris: 700-1000 kr/h (standard: 850 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.8).toFixed(1)}h` : '- Yta saknas - använd 4 kvm som antagande (= 11.2h)'}

**TOTALT för ${measurements?.area || 4} kvm badrum: ${measurements?.area ? (measurements.area * (2.5 + 2.8 + 2.5 + 2.2 + 2.8)).toFixed(0) : '51'} timmar**

**⚠️ ANVÄND ALDRIG 'badrumstotalrenovering' (50h/kvm) för ENSKILDA moment!**
Den standarden är ENDAST för att validera total-tid, inte för att beräkna delmoment.

**🚨 BERÄKNINGSREGEL: Multiplicera ALLTID standard (h/kvm) med faktisk area i kvm!**
Exempel: El-installation = 2.5h/kvm × ${measurements?.area || 4} kvm = ${measurements?.area ? (measurements.area * 2.5).toFixed(1) : '10'}h

` : ''}

${jobCategory === 'målning' ? `

**🎨 KRITISKT FÖR MÅLNING:**

⚠️ **ABSOLUTA MINIMIKRAV** som ALLTID MÅSTE ingå:

1. **Förberedelser och skydd** (OBLIGATORISKT - minst 2h)
   - Täcka golv och möbler med plast
   - Maskera fönster, dörrar, lister med tape
   - Standard: 0.04h per kvm väggyta
   - Timpris: 650-850 kr/h (standard: 750 kr/h)

2. **Spackling och slipning** (OBLIGATORISKT - minst 2h)
   - Reparera hål, sprickor i väggar
   - Slipa ojämna ytor
   - Standard: 0.04h per kvm väggyta
   - Timpris: 650-850 kr/h (standard: 750 kr/h)

3. **Grundmålning** (OBLIGATORISKT - minst 3h)
   - Första strykning med grundfärg
   - Täcker underlaget
   - Standard: 0.06h per kvm väggyta
   - Timpris: 700-900 kr/h (standard: 800 kr/h)

4. **Slutstrykningar** (OBLIGATORISKT - minst 4h)
   - 1-2 slutstrykningar beroende på färg
   - Mörka färger kräver extra strykningar
   - Standard: 0.08h per kvm väggyta
   - Timpris: 700-900 kr/h (standard: 800 kr/h)

5. **Städning och efterarbete** (OBLIGATORISKT - minst 2h)
   - Ta bort maskering och skydd
   - Städa färgrester
   - Slutbesiktning
   - Standard: 0.04h per kvm väggyta
   - Timpris: 500-650 kr/h (standard: 550 kr/h)

**MINIMUM KOSTNAD:**
- Minst ${measurements?.area ? (measurements.area * PAINTING_REQUIREMENTS.minimumCostPerSqm).toLocaleString('sv-SE') : '7 500'} kr (${measurements?.area || 50} kvm × ${PAINTING_REQUIREMENTS.minimumCostPerSqm} kr/kvm)
- Rekommenderat: ${measurements?.area ? (measurements.area * PAINTING_REQUIREMENTS.recommendedCostPerSqm).toLocaleString('sv-SE') : '15 000'} kr (${measurements?.area || 50} kvm × ${PAINTING_REQUIREMENTS.recommendedCostPerSqm} kr/kvm)

**VIKTIGA FAKTORER:**
- 🎨 Mörka färger (svart, mörk blå, etc.) → +1 slutstrykning
- 🔝 Takmålning → +20% timpris (svårare arbete)
- 🏠 Många rum → mer maskering och förberedelser

**⚠️ VALIDATION BLOCKERAR OM:**
- ❌ Saknas något av de 5 arbetsmomenten
- ❌ Total under ${measurements?.area ? (measurements.area * PAINTING_REQUIREMENTS.minimumCostPerSqm).toLocaleString('sv-SE') : '7 500'} kr
- ❌ För få timmar per arbetsmoment

` : ''}

${jobCategory === 'kök' ? `

**🍳 KRITISKT FÖR KÖKSRENOVERING${measurements?.area ? ` (${measurements.area} kvm)` : ''}:**

För kök ska du ALLTID dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Rivning och demontering** (jobType: 'rivning_kok')
   - Standard: 1.2-3.0h per kvm (typical: 2.0h/kvm)
   - Timpris: 650-850 kr/h (standard: 750 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.0).toFixed(1)}h` : '- Yta saknas - använd 10 kvm som antagande (= 20h)'}

2. **VVS-installation** (jobType: 'vvs_kok')
   - Standard: 1.2-2.5h per kvm (typical: 1.8h/kvm)
   - Timpris: 800-1100 kr/h (standard: 950 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 1.8).toFixed(1)}h` : '- Yta saknas - använd 10 kvm som antagande (= 18h)'}

3. **El-installation** (jobType: 'el_kok')
   - Standard: 1.5-2.5h per kvm (typical: 2.0h/kvm)
   - Timpris: 850-1100 kr/h (standard: 950 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 2.0).toFixed(1)}h` : '- Yta saknas - använd 10 kvm som antagande (= 20h)'}

4. **Montering skåp och bänkskiva** (jobType: 'montering_kok')
   - Standard: 4.0-6.0h per kvm (typical: 5.0h/kvm)
   - Timpris: 700-900 kr/h (standard: 800 kr/h)
   ${measurements?.area ? `- För ${measurements.area} kvm: ${(measurements.area * 5.0).toFixed(1)}h` : '- Yta saknas - använd 10 kvm som antagande (= 50h)'}

5. **Kakel backsplash** (jobType: 'kakel_backsplash', VALFRITT)
   - Standard: 1.0-2.0h per kvm (typical: 1.5h/kvm)
   - Timpris: 700-950 kr/h (standard: 800 kr/h)
   - Inkludera ENDAST om kunden nämner "kakel" eller "backsplash"

**TOTALT för ${measurements?.area || 10} kvm kök (utan kakel): ${measurements?.area ? (measurements.area * (2.0 + 1.8 + 2.0 + 5.0)).toFixed(0) : '108'} timmar**

**⚠️ ANVÄND ALDRIG 'kok_totalrenovering' för ENSKILDA moment!**

**🚨 BERÄKNINGSREGEL: Multiplicera ALLTID standard (h/kvm) med faktisk area i kvm!**
Exempel: VVS = 1.8h/kvm × ${measurements?.area || 10} kvm = ${measurements?.area ? (measurements.area * 1.8).toFixed(1) : '18'}h

` : ''}

${(jobCategory === 'målning' || description.toLowerCase().includes('måla')) ? `

**🚨 KRITISKT FÖR MÅLNING:**

För målning ska du ALLTID dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Spackling och slipning** (jobType: 'spackling_sliping')
   - Standard: 0.08-0.20h per kvm (typical: 0.12h/kvm)
   - Timpris: 550-800 kr/h (standard: 650 kr/h)
   - För 50 kvm: ~6h

2. **Grundning** (jobType: 'grundning')
   - Standard: 0.06-0.15h per kvm (typical: 0.10h/kvm)
   - Timpris: 550-800 kr/h (standard: 650 kr/h)
   - För 50 kvm: ~5h

3. **Målning första lagret** (jobType: 'malning_1_lager')
   - Standard: 0.10-0.20h per kvm (typical: 0.14h/kvm)
   - Timpris: 550-800 kr/h (standard: 650 kr/h)
   - För 50 kvm: ~7h

4. **Målning andra lagret** (jobType: 'malning_2_lager')
   - Standard: 0.06-0.14h per kvm (typical: 0.10h/kvm)
   - Timpris: 550-800 kr/h (standard: 650 kr/h)
   - För 50 kvm: ~5h

**TOTALT för 50 kvm målning: 23-27 timmar**

**⚠️ ANVÄND ALDRIG 'malning_inomhus' (0.4h/kvm) för ENSKILDA moment!**
Den standarden är ENDAST för att validera total-tid, inte för att beräkna delmoment.

` : ''}

${jobCategory === 'fasad' || description.toLowerCase().includes('fasad') ? `

**🚨 KRITISKT FÖR FASADMÅLNING:**

För fasadmålning ska du ALLTID dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Rengöring fasad** (jobType: 'fasad_rengoring')
   - Standard: 0.08-0.18h per kvm (typical: 0.12h/kvm)
   - Timpris: 550-900 kr/h (standard: 700 kr/h)
   - För 80 kvm fasad: ~10h

2. **Förberedelse och spackling** (jobType: 'fasad_forberedelse')
   - Standard: 0.04-0.15h per kvm (typical: 0.08h/kvm)
   - Timpris: 550-900 kr/h (standard: 700 kr/h)
   - För 80 kvm fasad: ~6.5h

3. **Målning fasad** (jobType: 'fasad_malning')
   - Standard: 0.25-0.50h per kvm (typical: 0.35h/kvm)
   - Timpris: 550-900 kr/h (standard: 700 kr/h)
   - För 80 kvm fasad: ~28h

4. **Ställning** (jobType: 'stallning') - VID BEHOV om fasad >4m höjd
   - Standard: 0.5-1.8h per kvm (typical: 1.0h/kvm)
   - MATERIALKOSTNAD (hyra): 100-250 kr/kvm (standard: 150 kr/kvm)
   - För 80 kvm fasad: ~12,000 kr i ställningskostnad

**TOTALT för 80 kvm fasad: 44-50 timmar + ställning vid behov**

**⚠️ ANVÄND ALDRIG 'malning_fasad' (0.3h/kvm) för ENSKILDA moment!**
Den standarden är ENDAST för att validera total-tid, inte för att beräkna delmoment.

` : ''}

${jobCategory === 'trädgård' ? `

**🚨 KRITISKT FÖR TRÄDGÅRDSARBETE:**

För trädgård ska du dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Markberedning** (jobType: 'markberedning') - VID BEHOV
   - Standard: 0.2-0.7h per kvm (typical: 0.4h/kvm)
   - Timpris: 450-650 kr/h (standard: 550 kr/h)
   - För 100 kvm: ~40h

2. **Plantering** (jobType: 'plantering')
   - Standard: 0.3-1.0h per växt (typical: 0.5h/växt)
   - Timpris: 450-650 kr/h (standard: 550 kr/h)
   - För 20 växter: ~10h

3. **Gräsklippning** (jobType: 'grasklippning') - OM RELEVANT
   - Standard: 0.002-0.005h per kvm (typical: 0.003h/kvm)
   - Timpris: 450-650 kr/h (standard: 550 kr/h)
   - För 500 kvm: ~1.5h

4. **Häckklippning** (jobType: 'hakkklippning') - OM RELEVANT
   - Standard: 0.08-0.15h per meter (typical: 0.10h/meter)
   - Timpris: 450-650 kr/h (standard: 550 kr/h)
   - För 50 meter: ~5h

**⚠️ VIKTIGT: Trädfällning är EJ RUT-berättigat!**

` : ''}

${jobCategory === 'golv' || description.toLowerCase().includes('parkett') ? `

**🚨 KRITISKT FÖR PARKETTLÄGGNING:**

För parkettläggning ska du ALLTID dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Underlagsarbete** (jobType: 'underlagsarbete')
   - Standard: 0.15-0.40h per kvm (typical: 0.25h/kvm)
   - Timpris: 600-900 kr/h (standard: 750 kr/h)
   - För 50 kvm: ~12.5h

2. **Läggning parkett** (jobType: 'parkett_laggning')
   - Standard: 0.5-1.3h per kvm (typical: 0.8h/kvm)
   - Timpris: 600-900 kr/h (standard: 750 kr/h)
   - För 50 kvm: ~40h

3. **Slipning** (jobType: 'slipning') - VID BEHOV
   - Standard: 0.15-0.40h per kvm (typical: 0.25h/kvm)
   - Timpris: 600-900 kr/h (standard: 750 kr/h)
   - För 50 kvm: ~12.5h

4. **Lackering** (jobType: 'lackering') - VID BEHOV
   - Standard: 0.15-0.35h per kvm (typical: 0.25h/kvm)
   - Timpris: 600-900 kr/h (standard: 750 kr/h)
   - För 50 kvm: ~12.5h

**TOTALT för 50 kvm parkett: 77-90 timmar (med slipning och lackering)**

**⚠️ ANVÄND ALDRIG 'parkettläggning' (1.5h/kvm) för ENSKILDA moment!**
Den standarden är ENDAST för att validera total-tid, inte för att beräkna delmoment.

` : ''}

${!['badrum', 'kök', 'målning'].includes(jobCategory) ? `

**⚙️ GENERISK GUIDE FÖR ${jobCategory.toUpperCase()}:**

För att undvika orealistiska timuppskattningar:

1. **Använd branschstandarder från INDUSTRY_STANDARDS**
   - Sök efter relevanta standarder i vårt system (findStandard)
   - Följ angivna timmar per enhet (h/kvm, h/rum, h/styck)

2. **Dela upp i logiska moment**
   - Rivning/förberedelser (om relevant)
   - Huvudarbete (specifikt för jobbet)
   - Efterarbete/städning

3. **Typical timpriser per yrkeskategori:**
   - Elektriker: 850-1100 kr/h
   - VVS: 900-1100 kr/h
   - Snickare: 700-850 kr/h
   - Målare: 650-850 kr/h
   - Murare: 750-900 kr/h
   - Städare: 500-650 kr/h
   - Trädgårdsskötare: 550-700 kr/h

4. **Sanity checks:**
   - Rivning: Max 3h/kvm för inomhus
   - Installation: 1-4h/kvm beroende på komplexitet
   - Efterarbete: Max 10% av total tid

` : ''}
`;
  
  // ============ HÄMTA ANVÄNDARDATA ============
  
  const { data: userRates } = await supabase
    .from('hourly_rates')
    .select('*')
    .eq('user_id', userId);
  
  const { data: userEquipment } = await supabase
    .from('equipment_rates')
    .select('*')
    .eq('user_id', userId);

  // ============ LAGER 2: BRANSCHDATA (VALIDERING - 80% VIKT) ============
  
  // 2.1 Hämta liknande accepterade offerter
  const { data: similarQuotes } = await supabase
    .rpc('find_similar_quotes', {
      user_id_param: userId,
      description_param: description,
      limit_param: 3
    });
  
  // 2.2 Hämta branschstandarder från industry_benchmarks
  const { data: benchmarks } = await supabase
    .from('industry_benchmarks')
    .select('*')
    .order('sample_size', { ascending: false })
    .limit(20);
  
  // 2.3 Hämta aggregerad kunskap från industry_knowledge
  const { data: industryKnowledge } = await supabase
    .from('industry_knowledge')
    .select('*')
    .eq('category', 'standard_work_items')
    .gte('content->uniqueUsers', 3)
    .order('content->acceptanceRate', { ascending: false })
    .limit(20);
  
  const layer2_industry = `
**LAGER 2: BRANSCHDATA (VALIDERING - 80% vikt)**

**Liknande accepterade offerter (från andra användare):**
${similarQuotes && similarQuotes.length > 0 ? similarQuotes.map((q: any) => `
- "${q.title}" (${q.description})
  Likhet: ${(q.similarity_score * 100).toFixed(0)}%
  Arbetsmoment: ${JSON.stringify(q.quote_data?.workItems?.map((w: any) => w.name))}
`).join('\n') : 'Inga liknande offerter hittades'}

**Branschstandarder (från ${benchmarks?.length || 0} källor):**
${benchmarks && benchmarks.length > 0 ? benchmarks.map((b: any) => 
  `- ${b.work_category}: ${b.median_value} ${b.metric_type} (${b.min_value}-${b.max_value}) [${b.sample_size} användare]`
).join('\n') : 'Inga branschstandarder tillgängliga'}

**Standardmoment (baserat på ${industryKnowledge?.length || 0} accepterade mönster):**
${industryKnowledge && industryKnowledge.length > 0 ? industryKnowledge.map((item: any) => `
- "${item.content.workItem}" 
  ✓ Accepterat av ${item.content.uniqueUsers} användare (${item.content.acceptanceRate} ggr)
  ✓ Genomsnitt: ~${Math.round(item.content.avgHours || 0)}h, ~${Math.round(item.content.avgCost || 0)} kr
  ✓ Confidence: ${(item.content.avgConfidence * 100).toFixed(0)}%
`).join('\n') : 'Inga standardmoment identifierade än (kräver minst 3 olika användare)'}

**INSTRUKTION:** Använd denna data för att VALIDERA marknadspriser och föreslå standardmoment.
Om ett projekt liknar dessa standardmoment, överväg att inkludera dem.
`;

  // ============ LAGER 3: ANVÄNDARDATA (VIKTAD 0-100% EFTER ERFARENHET) ============
  
  const layer3_user = `
**LAGER 3: ANVÄNDARDATA (VIKTAD ${userWeighting.toFixed(0)}% efter ${totalQuotes} offerter)**

**Konversationshistorik:**
${conversationHistory.map(m => `${m.role === 'user' ? 'Kund' : 'Du'}: ${m.content}`).join('\n')}

**Användarens prissättningsprofil:**
${userPatterns ? `
- Prissättningsstil: ${userPatterns.pricing_style || 'market_rate'}
- Genomsnittlig marginal: ${userPatterns.typical_margins?.avg || 'okänd'}%
- Material/arbete-ratio: ${userPatterns.avg_material_to_work_ratio || 'okänd'}
- Detaljnivå-preferens: ${userPatterns.preferred_detail_level || 'standard'}
- Totalt ${totalQuotes} offerter skapade → ${userWeighting.toFixed(0)}% vikt
` : 'Ingen historik tillgänglig (ny användare)'}

**Användarens egna timpriser (${userWeighting.toFixed(0)}% vikt):**
${userRates && userRates.length > 0 ? userRates.map((r: any) => 
  `- ${r.work_type}: ${r.rate} kr/h`
).join('\n') : 'Inga egna timpriser angivna → använd marknadspriser'}

**Användarens utrustningspriser:**
${userEquipment && userEquipment.length > 0 ? userEquipment.map((e: any) => 
  `- ${e.equipment_name}: ${e.rate_per_day} kr/dag`
).join('\n') : 'Ingen egen utrustning angiven → använd standardpriser'}

**INSTRUKTION VIKTAD HYBRIDMODELL:**
${totalQuotes === 0 ? `
🆕 NY ANVÄNDARE (0 offerter):
- Använd 100% marknadspriser från Lager 1
- Ge genast trovärdiga priser som matchar marknaden
- Bygg förtroende genom realistiska estimat
` : totalQuotes < 10 ? `
📊 VÄXANDE ANVÄNDARE (${totalQuotes} offerter):
- Använd ${marketWeighting.toFixed(0)}% marknadspriser + ${userWeighting.toFixed(0)}% användarens priser
- Weighted average: (user_rate × ${userWeighting.toFixed(0)}%) + (market_rate × ${marketWeighting.toFixed(0)}%)
- Gradvis anpassning till användarens prisnivå
` : `
👤 ERFAREN ANVÄNDARE (${totalQuotes} offerter):
- Använd ${userWeighting.toFixed(0)}% användarens priser + ${marketWeighting.toFixed(0)}% marknadspriser
- Systemet är nu anpassat till användarens faktiska prisnivå
- Marknadspriser används endast för validering
`}
`;

  console.log('✅ FAS 0: Hybrid layered prompt built successfully');
  
  return { 
    layer1_market, 
    layer2_industry, 
    layer3_user, 
    userWeighting,
    // PUNKT 3: Kategori-specifika värden
    jobCategory,
    categoryWeighting,
    categoryAvgRate,
    categoryQuotes
  };
}
