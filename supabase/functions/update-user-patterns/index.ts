import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// Import category detector
function detectJobCategory(description: string, jobType?: string): string {
  const normalized = description.toLowerCase();
  
  if (jobType) {
    const type = jobType.toLowerCase();
    if (type.includes('målning') || type.includes('måla')) return 'målning';
    if (type.includes('badrum') || type.includes('våtrum')) return 'badrum';
    if (type.includes('kök')) return 'kök';
    if (type.includes('el')) return 'el';
    if (type.includes('vvs') || type.includes('rör')) return 'vvs';
    if (type.includes('trädgård') || type.includes('gräs')) return 'trädgård';
    if (type.includes('städ')) return 'städning';
    if (type.includes('golv') || type.includes('parkett') || type.includes('klinker')) return 'golv';
    if (type.includes('puts') || type.includes('fasad')) return 'fasad';
    if (type.includes('fönster') || type.includes('dörr')) return 'fönster_dörr';
    if (type.includes('tak')) return 'tak';
  }
  
  if (normalized.includes('måla') || normalized.includes('målning') || normalized.includes('färg')) return 'målning';
  if (normalized.includes('badrum') || normalized.includes('dusch') || normalized.includes('wc')) return 'badrum';
  if (normalized.includes('kök')) return 'kök';
  if (normalized.includes('el') || normalized.includes('uttag') || normalized.includes('belysning')) return 'el';
  if (normalized.includes('vvs') || normalized.includes('rör') || normalized.includes('avlopp')) return 'vvs';
  if (normalized.includes('trädgård') || normalized.includes('gräs') || normalized.includes('träd')) return 'trädgård';
  if (normalized.includes('städ') || normalized.includes('flytt')) return 'städning';
  if (normalized.includes('parkett') || normalized.includes('golv') || normalized.includes('klinker')) return 'golv';
  if (normalized.includes('puts') || normalized.includes('fasad')) return 'fasad';
  if (normalized.includes('fönster') || normalized.includes('dörr')) return 'fönster_dörr';
  if (normalized.includes('tak')) return 'tak';
  
  return 'övrigt';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating user patterns for:', user.id);

    // Hämta användarens senaste 20 offerter
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('generated_quote, edited_quote, status, detail_level')
      .eq('user_id', user.id)
      .in('status', ['accepted', 'completed', 'sent', 'draft'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      throw quotesError;
    }

    if (!quotes || quotes.length === 0) {
      console.log('No quotes found for user');
      return new Response(
        JSON.stringify({ message: 'No quotes to analyze', patterns: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Analyzing ${quotes.length} quotes`);

    // Analysera data
    const workTypeHours = new Map<string, number[]>();
    const workTypeRates = new Map<string, number[]>();
    const quoteValues: number[] = [];
    const materialToWorkRatios: number[] = [];
    const projectTypes: string[] = [];
    const descriptions: string[] = [];
    const detailLevels: string[] = [];

    // Kategori-analys (NYT)
    const categoryData = new Map<string, { quotes: number; totalValue: number; rates: number[] }>();

    quotes.forEach(q => {
      const quote = q.edited_quote || q.generated_quote;
      if (!quote) return;

      // Samla data
      if (quote.summary?.customerPays) {
        quoteValues.push(quote.summary.customerPays);
      }

      if (q.detail_level) {
        detailLevels.push(q.detail_level);
      }

      // Detektera kategori för denna offert
      const jobType = quote.projectType || '';
      const description = quote.description || '';
      const category = detectJobCategory(description, jobType);

      // Uppdatera kategori-data
      if (!categoryData.has(category)) {
        categoryData.set(category, { quotes: 0, totalValue: 0, rates: [] });
      }
      const catData = categoryData.get(category)!;
      catData.quotes += 1;
      if (quote.summary?.customerPays) {
        catData.totalValue += quote.summary.customerPays;
      }

      // Analysera arbetstyper och timpriser
      if (quote.workItems) {
        quote.workItems.forEach((item: any) => {
          const workType = item.name.split(' - ')[0].trim();
          
          if (!workTypeHours.has(workType)) {
            workTypeHours.set(workType, []);
          }
          workTypeHours.get(workType)!.push(item.hours || 0);

          if (!workTypeRates.has(workType)) {
            workTypeRates.set(workType, []);
          }
          const rate = item.hourlyRate || 0;
          workTypeRates.get(workType)!.push(rate);
          
          // Lägg till timpris i kategori-data
          if (rate > 0) {
            catData.rates.push(rate);
          }

          // Samla beskrivningar för stil-analys
          if (item.description) {
            descriptions.push(item.description);
          }
        });
      }

      // Material/arbete-ratio
      if (quote.summary?.workCost && quote.summary?.materialCost) {
        const ratio = quote.summary.materialCost / quote.summary.workCost;
        materialToWorkRatios.push(ratio);
      }
    });

    // Beräkna aggregerad statistik
    const avgQuoteValue = quoteValues.length > 0
      ? quoteValues.reduce((sum, v) => sum + v, 0) / quoteValues.length
      : null;

    // Föredraget detaljnivå (mode)
    const detailLevelCounts = new Map<string, number>();
    detailLevels.forEach(level => {
      detailLevelCounts.set(level, (detailLevelCounts.get(level) || 0) + 1);
    });
    let preferredDetailLevel = 'standard';
    let maxCount = 0;
    detailLevelCounts.forEach((count, level) => {
      if (count > maxCount) {
        maxCount = count;
        preferredDetailLevel = level;
      }
    });

    // Arbetstypsfördelning (procent av totala timmar)
    const totalHours = Array.from(workTypeHours.values())
      .flat()
      .reduce((sum, h) => sum + h, 0);
    
    const workTypeDistribution: Record<string, number> = {};
    workTypeHours.forEach((hours, workType) => {
      const totalForType = hours.reduce((sum, h) => sum + h, 0);
      workTypeDistribution[workType] = Math.round((totalForType / totalHours) * 100);
    });

    // Genomsnittliga timpriser per arbetstyp
    const avgHourlyRates: Record<string, number> = {};
    workTypeRates.forEach((rates, workType) => {
      const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
      avgHourlyRates[workType] = Math.round(avg);
    });

    // Material/arbete-ratio
    const avgMaterialToWorkRatio = materialToWorkRatios.length > 0
      ? materialToWorkRatios.reduce((sum, r) => sum + r, 0) / materialToWorkRatios.length
      : null;

    // Stil-analys
    const usesEmojis = descriptions.some(d => /[\p{Emoji}]/u.test(d));
    const avgDescriptionLength = descriptions.length > 0
      ? Math.round(descriptions.reduce((sum, d) => sum + d.length, 0) / descriptions.length)
      : null;

    // Beräkna kategori-viktning (NYT)
    const categoryWeighting: Record<string, any> = {};
    categoryData.forEach((data, category) => {
      const userWeighting = Math.min(100, (data.quotes / 20) * 100);
      const avgRate = data.rates.length > 0
        ? Math.round(data.rates.reduce((sum, r) => sum + r, 0) / data.rates.length)
        : null;
      
      categoryWeighting[category] = {
        total_quotes: data.quotes,
        user_weighting: Math.round(userWeighting),
        avg_rate: avgRate,
        avg_value: data.totalValue > 0 ? Math.round(data.totalValue / data.quotes) : null
      };
    });

    // Bygg patterns-objekt
    const patterns = {
      user_id: user.id,
      total_quotes: quotes.length,
      avg_quote_value: avgQuoteValue,
      preferred_detail_level: preferredDetailLevel,
      work_type_distribution: workTypeDistribution,
      avg_hourly_rates: avgHourlyRates,
      avg_material_to_work_ratio: avgMaterialToWorkRatio,
      common_project_types: projectTypes.slice(0, 5), // Top 5
      uses_emojis: usesEmojis,
      avg_description_length: avgDescriptionLength,
      category_weighting: categoryWeighting,  // NYT
      sample_size: quotes.length,
      last_updated: new Date().toISOString()
    };

    // Upsert till databas
    const { error: upsertError } = await supabase
      .from('user_quote_patterns')
      .upsert(patterns, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error upserting patterns:', upsertError);
      throw upsertError;
    }

    console.log('📊 Updated user patterns:', {
      user_id: user.id,
      quotes_analyzed: quotes.length,
      avg_value: patterns.avg_quote_value?.toFixed(0) || 0,
      work_types: Object.keys(workTypeDistribution).join(', '),
      detail_level: patterns.preferred_detail_level
    });

    return new Response(
      JSON.stringify({ 
        message: 'User patterns updated successfully',
        patterns: {
          totalQuotes: patterns.total_quotes,
          avgQuoteValue: patterns.avg_quote_value,
          preferredDetailLevel: patterns.preferred_detail_level,
          sampleSize: patterns.sample_size
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in update-user-patterns:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
