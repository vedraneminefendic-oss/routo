// FAS 1: Tredelad promptstruktur för Handoff-liknande AI

interface LayeredContext {
  layer1: string;
  layer2: string;
  layer3: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * FAS 1: Bygger tredelad promptstruktur
 * Lager 1: Användarspecifik kontext (högsta prioritet)
 * Lager 2: Global branschdata (medium prioritet)
 * Lager 3: Extern kunskap (lägsta prioritet, fallback)
 */
export async function buildLayeredPrompt(
  userId: string,
  description: string,
  conversationHistory: ConversationMessage[],
  measurements: any,
  supabase: any,
  liveSearchResult?: any
): Promise<LayeredContext> {
  
  console.log('🏗️ FAS 1: Building 3-layer prompt structure...');
  
  // ============ LAGER 1: ANVÄNDARSPECIFIK KONTEXT (HÖGSTA PRIORITET) ============
  
  // 1.1 Hämta användarens historik från user_quote_patterns
  const { data: userPatterns } = await supabase
    .from('user_quote_patterns')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // 1.2 Hämta användarens timpriser
  const { data: userRates } = await supabase
    .from('hourly_rates')
    .select('*')
    .eq('user_id', userId);
  
  // 1.3 Hämta användarens utrustningspriser
  const { data: userEquipment } = await supabase
    .from('equipment_rates')
    .select('*')
    .eq('user_id', userId);
  
  // 1.4 Bygg Lager 1-text
  const layer1 = `
**LAGER 1: ANVÄNDARSPECIFIK KONTEXT (HÖGSTA PRIORITET)**

**Konversationshistorik:**
${conversationHistory.map(m => `${m.role === 'user' ? 'Kund' : 'Du'}: ${m.content}`).join('\n')}

**Användarens prissättningsprofil:**
${userPatterns ? `
- Prissättningsstil: ${userPatterns.pricing_style || 'market_rate'} 
  (budget = lägre än marknad, premium = högre än marknad)
- Genomsnittlig marginal: ${userPatterns.typical_margins?.avg || 'okänd'}%
- Material/arbete-ratio: ${userPatterns.avg_material_to_work_ratio || 'okänd'}
- Detaljnivå-preferens: ${userPatterns.preferred_detail_level || 'standard'}
- Totalt ${userPatterns.total_quotes || 0} offerter skapade
` : 'Ingen historik tillgänglig - använd branschstandarder'}

**Användarens egna timpriser:**
${userRates && userRates.length > 0 ? userRates.map((r: any) => 
  `- ${r.work_type}: ${r.rate} kr/h`
).join('\n') : 'Inga egna timpriser angivna'}

**Användarens utrustningspriser:**
${userEquipment && userEquipment.length > 0 ? userEquipment.map((e: any) => 
  `- ${e.equipment_name}: ${e.rate_per_day} kr/dag`
).join('\n') : 'Ingen egen utrustning angiven'}

**INSTRUKTION:** Detta är DIN användares preferenser. Prioritera dessa framför allt annat!
`;

  // ============ LAGER 2: GLOBAL BRANSCHDATA (MEDIUM PRIORITET) ============
  
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
  
  // 2.3 Hämta aggregerad kunskap från industry_knowledge (FAS 7)
  const { data: industryKnowledge } = await supabase
    .from('industry_knowledge')
    .select('*')
    .eq('category', 'standard_work_items')
    .gte('content->uniqueUsers', 3)
    .order('content->acceptanceRate', { ascending: false })
    .limit(20);
  
  // 2.4 Bygg Lager 2-text
  const layer2 = `
**LAGER 2: GLOBAL BRANSCHDATA (MEDIUM PRIORITET)**

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

**Standardmoment (baserat på ${industryKnowledge?.length || 0} accepterade mönster från FAS 7):**
${industryKnowledge && industryKnowledge.length > 0 ? industryKnowledge.map((item: any) => `
- "${item.content.workItem}" 
  ✓ Accepterat av ${item.content.uniqueUsers} användare (${item.content.acceptanceRate} ggr)
  ✓ Genomsnitt: ~${Math.round(item.content.avgHours || 0)}h, ~${Math.round(item.content.avgCost || 0)} kr
  ✓ Confidence: ${(item.content.avgConfidence * 100).toFixed(0)}%
`).join('\n') : 'Inga standardmoment identifierade än (kräver minst 3 olika användare)'}

**INSTRUKTION:** Använd denna data om Lager 1 saknar information, eller för att validera användarens priser mot marknaden.
Om ett projekt liknar dessa standardmoment, överväg att inkludera dem (men bara om relevanta för just detta projekt).
`;

  // ============ LAGER 3: EXTERN KUNSKAP (LÄGSTA PRIORITET - FALLBACK) ============
  
  // 3.1 Bygg Lager 3-text med eventuell live-sökning
  const layer3 = `
**LAGER 3: EXTERN KUNSKAP (FALLBACK - LÄGSTA PRIORITET)**

${liveSearchResult ? `
**Live-webbsökning utförd:**
- Arbetstyp: ${description}
- Tidsuppskattning: ${liveSearchResult.timeEstimate} timmar
- Prisklass: ${liveSearchResult.priceRange.min}-${liveSearchResult.priceRange.max} kr
- Källa: ${liveSearchResult.source}
- Confidence: 0.6 (extern data, ej verifierad)

**OBS:** Denna data är hämtad från öppna källor och har lägre tillförlitlighet än Lager 1 och 2.
` : 'Ingen live-sökning utförd - tillräcklig data finns i Lager 1 och 2'}

**ROT/RUT-regler (från Skatteverket):**
- ROT: 50% avdrag på arbetskostnad, max 75 000 kr/år per person
  - Gäller: Renovering, ombyggnad, tillbyggnad, underhåll i BOSTAD
  - Gäller INTE: Nybyggnation, fritidshus som inte är permanentbostad
- RUT: 50% avdrag på arbetskostnad, max 75 000 kr/år per person
  - Gäller: Hushållsnära tjänster (städning, trädgård, snöröjning, flytthjälp)
  - Gäller INTE: Arbete på annans fastighet, material, trädfällning

**INSTRUKTION:** Använd denna data ENDAST om Lager 1 och 2 saknar information. Markera alltid med lägre confidence (0.5-0.7) om du använder Lager 3.
`;

  console.log('✅ FAS 1: Layered prompt built successfully');
  
  return { layer1, layer2, layer3 };
}
