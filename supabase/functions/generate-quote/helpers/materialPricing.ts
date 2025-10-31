// FAS 4: Materialprissättning med caching

const TEXT_MODEL = 'google/gemini-2.5-flash';

/**
 * Helper: Kontrollera om cached data är färsk nog
 */
export function isRecentEnough(lastUpdated: string, maxDaysOld: number): boolean {
  const cacheDate = new Date(lastUpdated);
  const now = new Date();
  const daysDiff = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= maxDaysOld;
}

/**
 * FAS 4: Söker materialpris med fallback-strategi
 * 1. Kolla cache först (industry_benchmarks)
 * 2. Om inte: Sök på webben via AI
 * 3. Spara resultatet i cache för framtida användning
 */
export async function searchMaterialPriceLive(
  materialName: string,
  unit: string,
  lovableApiKey: string,
  supabase: any
): Promise<{ price: number; source: string; confidence: number } | null> {
  
  console.log(`🔍 FAS 4: Live search for material: ${materialName}`);
  
  const cacheKey = `material_${materialName.toLowerCase().replace(/\s+/g, '_')}`;
  
  // 1. Kolla cache först (industry_benchmarks)
  const { data: cachedPrice } = await supabase
    .from('industry_benchmarks')
    .select('*')
    .eq('work_category', cacheKey)
    .eq('metric_type', 'price_per_unit')
    .single();
  
  if (cachedPrice && isRecentEnough(cachedPrice.last_updated, 30)) { // 30 dagar
    console.log(`✅ Using cached price: ${cachedPrice.median_value} kr`);
    return {
      price: cachedPrice.median_value,
      source: 'cached_industry_benchmarks',
      confidence: 0.8
    };
  }
  
  // 2. Annars: Sök på webben via AI
  const prompt = `Sök på svenska byggvaruhus (Bauhaus, Hornbach, K-Rauta, Beijer, ByggMax) och hitta aktuellt pris för:

**Material:** ${materialName}
**Enhet:** ${unit}

Returnera JSON:
{
  "averagePrice": X,
  "priceRange": { "min": Y, "max": Z },
  "sources": ["byggvaruhus1", "byggvaruhus2"]
}

**EXEMPEL:**
- "Innerväggsfärg 10L" → averagePrice: 1200, priceRange: {min: 900, max: 1500}
- "Kakel 1 kvm" → averagePrice: 350, priceRange: {min: 200, max: 600}
- "Gips 25 kg" → averagePrice: 120, priceRange: {min: 90, max: 150}
- "Trall 28x120mm löpmeter" → averagePrice: 85, priceRange: {min: 65, max: 110}

**VIKTIGT:**
- Basera på FAKTISKA priser från svenska byggvaruhus
- Om du hittar flera källor, ta genomsnitt
- Om osäker, ge ett rimligt intervall`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: 'Du är en byggmaterial-expert som söker och sammanfattar priser från svenska byggvaruhus.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('❌ Material price search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    // 3. Spara i cache (industry_benchmarks)
    await supabase.from('industry_benchmarks').upsert({
      work_category: cacheKey,
      metric_type: 'price_per_unit',
      median_value: result.averagePrice,
      min_value: result.priceRange.min,
      max_value: result.priceRange.max,
      sample_size: result.sources?.length || 1,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'work_category,metric_type',
      ignoreDuplicates: false
    });
    
    console.log(`✅ Learned material price from web: ${materialName} = ${result.averagePrice} kr (cached for 30 days)`);
    
    return {
      price: result.averagePrice,
      source: 'live_web_search',
      confidence: 0.6 // Lägre confidence för extern data
    };
    
  } catch (error) {
    console.error('❌ Failed to search material price:', error);
    return null;
  }
}
