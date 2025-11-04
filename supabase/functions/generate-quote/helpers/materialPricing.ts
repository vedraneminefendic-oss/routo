// ============================================================================
// FAS 2: MATERIALPRISSÄTTNING MED BUCKETS + ANVÄNDARPÅSLAG
// ============================================================================

import { JobDefinition } from './jobRegistry.ts';

const TEXT_MODEL = 'google/gemini-2.5-flash';

interface MaterialPrice {
  budget: number;
  standard: number;
  premium: number;
  source: string;
  confidence: number;
}

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
 * FAS 2: Hämta materialpris med 3 nivåer + användarens påslag
 * 1. Kolla cache först (30 dagar)
 * 2. Om inte: Sök på webben med 3 prisnivåer
 * 3. Applicera användarens påslag
 * 4. Spara i cache för framtida användning
 */
export async function getMaterialPrice(
  materialName: string,
  qualityLevel: 'budget' | 'standard' | 'premium',
  jobDef: JobDefinition,
  userMarkup: number = 0, // % påslag (t.ex. 12%)
  lovableApiKey: string,
  supabase: any
): Promise<{ price: number; source: string; confidence: number }> {
  
  console.log(`🔍 FAS 2: Fetching material price for: ${materialName} (${qualityLevel})`);
  
  const cacheKey = `material_${materialName.toLowerCase().replace(/\s+/g, '_')}`;
  
  // 1. Kolla cache först (industry_benchmarks) - innehåller 3 nivåer
  const { data: cachedPrice } = await supabase
    .from('industry_benchmarks')
    .select('*')
    .eq('work_category', cacheKey)
    .eq('metric_type', 'price_per_unit')
    .single();
  
  if (cachedPrice && isRecentEnough(cachedPrice.last_updated, 30)) { // 30 dagar
    // Cache innehåller: min_value (budget), median_value (standard), max_value (premium)
    const priceMap = {
      budget: cachedPrice.min_value,
      standard: cachedPrice.median_value,
      premium: cachedPrice.max_value
    };
    
    const basePrice = priceMap[qualityLevel];
    const finalPrice = Math.round(basePrice * (1 + userMarkup / 100));
    
    console.log(`✅ Using cached price: ${basePrice} kr → ${finalPrice} kr (with ${userMarkup}% markup)`);
    return {
      price: finalPrice,
      source: 'cached_with_user_markup',
      confidence: 0.85
    };
  }
  
  // 2. Annars: Sök på webben med 3 prisnivåer
  const prompt = `Sök på svenska byggvaruhus (Bauhaus, Hornbach, K-Rauta, Beijer, ByggMax) och hitta aktuellt pris för:

**Material:** ${materialName}

Returnera JSON med 3 prisnivåer:
{
  "budgetPrice": X,
  "standardPrice": Y,
  "premiumPrice": Z,
  "sources": ["byggvaruhus1", "byggvaruhus2"]
}

**EXEMPEL:**
- "Innerväggsfärg 10L" → budgetPrice: 900, standardPrice: 1200, premiumPrice: 1800
- "Kakel per kvm" → budgetPrice: 200, standardPrice: 400, premiumPrice: 800
- "Gips 25 kg" → budgetPrice: 90, standardPrice: 120, premiumPrice: 160

**VIKTIGT:**
- budgetPrice = lågprismärken från ByggMax/Bauhaus
- standardPrice = mellanklassmärken (Alcro, Beckers basic)
- premiumPrice = premiummärken (Beckers Designer, specialprodukter)
- Basera på FAKTISKA priser från svenska byggvaruhus`;

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
      // Fallback till jobDef.materialBuckets vid API-fel
      const bucket = jobDef.materialBuckets[qualityLevel];
      const estimatedPrice = Math.round(
        jobDef.hourlyRateRange.typical * jobDef.materialRatio * bucket.priceMultiplier
      );
      const finalPrice = Math.round(estimatedPrice * (1 + userMarkup / 100));
      
      return {
        price: finalPrice,
        source: 'job_definition_estimate_api_error',
        confidence: 0.5
      };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    // 3. Spara i cache med 3 nivåer
    await supabase.from('industry_benchmarks').upsert({
      work_category: cacheKey,
      metric_type: 'price_per_unit',
      min_value: result.budgetPrice,
      median_value: result.standardPrice,
      max_value: result.premiumPrice,
      sample_size: result.sources?.length || 1,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'work_category,metric_type',
      ignoreDuplicates: false
    });
    
    // 4. Applicera användarens påslag
    const priceMap = {
      budget: result.budgetPrice,
      standard: result.standardPrice,
      premium: result.premiumPrice
    };
    
    const basePrice = priceMap[qualityLevel];
    const finalPrice = Math.round(basePrice * (1 + userMarkup / 100));
    
    console.log(`✅ Learned material from web: ${materialName} = ${basePrice} kr → ${finalPrice} kr (with ${userMarkup}% markup)`);
    
    return {
      price: finalPrice,
      source: 'web_search_with_user_markup',
      confidence: 0.75
    };
    
  } catch (error) {
    console.error('❌ Failed to search material price:', error);
    
    // 5. Fallback till jobDef.materialBuckets
    const bucket = jobDef.materialBuckets[qualityLevel];
    const estimatedPrice = Math.round(
      jobDef.hourlyRateRange.typical * jobDef.materialRatio * bucket.priceMultiplier
    );
    const finalPrice = Math.round(estimatedPrice * (1 + userMarkup / 100));
    
    console.log(`⚠️ Using job definition estimate: ${estimatedPrice} kr → ${finalPrice} kr`);
    
    return {
      price: finalPrice,
      source: 'job_definition_estimate',
      confidence: 0.6
    };
  }
}

/**
 * LEGACY: Backwards compatibility with old searchMaterialPriceLive
 */
export async function searchMaterialPriceLive(
  materialName: string,
  unit: string,
  lovableApiKey: string,
  supabase: any
): Promise<{ price: number; source: string; confidence: number } | null> {
  // Fallback till ny funktion med standard quality och 0% markup
  const result = await getMaterialPrice(
    materialName,
    'standard',
    {
      jobType: 'ai_driven',
      materialRatio: 0.3,
      hourlyRateRange: { min: 450, typical: 650, max: 850 },
      materialBuckets: {
        budget: { priceMultiplier: 0.8, examples: [] },
        standard: { priceMultiplier: 1.0, examples: [] },
        premium: { priceMultiplier: 1.3, examples: [] }
      }
    } as any,
    0,
    lovableApiKey,
    supabase
  );
  
  return result;
}
