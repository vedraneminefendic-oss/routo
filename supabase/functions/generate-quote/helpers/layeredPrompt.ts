// ============================================================================
// LAYERED PROMPT - FAS 0: HYBRIDMODELL (WEB → BRANSCH → USER)
// ============================================================================

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

**🚨 KRITISKT FÖR BADRUMSRENOVERING:**

För badrum ska du ALLTID dela upp arbetet i SEPARATA moment med MOMENT-SPECIFIKA standarder:

1. **Rivning och demontering** (jobType: 'rivning_badrum')
   - Standard: 1.5-3.5h per kvm (typical: 2.5h/kvm)
   - Timpris: 650-900 kr/h (standard: 750 kr/h)
   - För 5 kvm badrum: ~12.5h

2. **VVS-installation** (jobType: 'vvs_badrum')
   - Standard: 2.0-4.0h per kvm (typical: 2.8h/kvm)
   - Timpris: 800-1100 kr/h (standard: 950 kr/h)
   - För 5 kvm badrum: ~14h

3. **El-installation** (jobType: 'el_badrum')
   - Standard: 1.8-3.2h per kvm (typical: 2.5h/kvm)
   - Timpris: 850-1100 kr/h (standard: 950 kr/h)
   - För 5 kvm badrum: ~12.5h

4. **Kakelsättning väggar** (jobType: 'kakel_vagg')
   - Standard: 1.5-3.0h per kvm (typical: 2.2h/kvm)
   - Timpris: 700-950 kr/h (standard: 800 kr/h)
   - För 5 kvm badrum: ~11h

5. **Klinkersättning golv** (jobType: 'klinker_golv')
   - Standard: 2.0-3.5h per kvm (typical: 2.8h/kvm)
   - Timpris: 700-1000 kr/h (standard: 850 kr/h)
   - För 5 kvm badrum: ~14h

**TOTALT för 5 kvm badrum: 64-70 timmar (inte 300+!)**

**⚠️ ANVÄND ALDRIG 'badrumstotalrenovering' (50h/kvm) för ENSKILDA moment!**
Den standarden är ENDAST för att validera total-tid, inte för att beräkna delmoment.

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
