import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

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

    console.log('Starting industry data aggregation...');

    // Hämta alla offerter från senaste 6 månaderna
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('generated_quote, edited_quote, created_at, description, user_id')
      .gte('created_at', sixMonthsAgo.toISOString())
      .in('status', ['accepted', 'completed', 'sent']);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      throw quotesError;
    }

    console.log(`Found ${quotes?.length || 0} quotes to analyze`);

    if (!quotes || quotes.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No quotes to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fas 14B: GDPR-säker kategorisering med k-anonymity
    // Gruppera först per user_id för att säkerställa minst 5 användare per kategori
    const usersByCategory = new Map<string, Set<string>>();
    const categories = new Map<string, any[]>();
    
    quotes.forEach(q => {
      const quote = q.edited_quote || q.generated_quote;
      if (!quote) return;

      const desc = q.description.toLowerCase();
      let category = 'övrigt';

      if (desc.includes('badrum') || desc.includes('våtrum')) {
        category = 'badrum';
      } else if (desc.includes('kök')) {
        category = 'kök';
      } else if (desc.includes('målning') || desc.includes('måla')) {
        category = 'målning';
      } else if (desc.includes('städ')) {
        category = 'städning';
      } else if (desc.includes('träd') || desc.includes('fäll')) {
        category = 'trädvård';
      } else if (desc.includes('trädgård')) {
        category = 'trädgård';
      }

      if (!categories.has(category)) {
        categories.set(category, []);
        usersByCategory.set(category, new Set());
      }
      categories.get(category)!.push(quote);
      
      // Spåra användare per kategori (för k-anonymity)
      if (q.user_id) {
        usersByCategory.get(category)!.add(q.user_id);
      }
    });

    console.log(`Categorized into ${categories.size} categories`);
    
    // GDPR: Filtrera bort kategorier med mindre än 5 unika användare
    const MINIMUM_USERS_FOR_ANONYMITY = 5;
    const validCategories = new Map<string, any[]>();
    
    categories.forEach((quotes, category) => {
      const uniqueUsers = usersByCategory.get(category)?.size || 0;
      if (uniqueUsers >= MINIMUM_USERS_FOR_ANONYMITY) {
        validCategories.set(category, quotes);
        console.log(`✅ ${category}: ${quotes.length} quotes from ${uniqueUsers} users (GDPR-compliant)`);
      } else {
        console.log(`⚠️ ${category}: Only ${uniqueUsers} users - SKIPPED for GDPR compliance (need ${MINIMUM_USERS_FOR_ANONYMITY})`);
      }
    });
    
    console.log(`After GDPR filtering: ${validCategories.size} valid categories`);

    // Beräkna benchmarks endast för GDPR-säkra kategorier
    const benchmarks: any[] = [];

    for (const [category, categoryQuotes] of validCategories.entries()) {
      // Samla alla timpriser per arbetstyp
      const hourlyRatesByType = new Map<string, number[]>();
      const totalHoursByCategory: number[] = [];
      const materialCosts: number[] = [];
      const workMaterialRatios: number[] = [];

      categoryQuotes.forEach((quote: any) => {
        if (!quote.workItems || !quote.summary) return;

        // Samla timpriser per arbetstyp
        quote.workItems.forEach((item: any) => {
          const workType = item.name.split(' - ')[0]; // "Snickare - Rivning" → "Snickare"
          if (!hourlyRatesByType.has(workType)) {
            hourlyRatesByType.set(workType, []);
          }
          hourlyRatesByType.get(workType)!.push(item.hourlyRate);
        });

        // Samla totala timmar
        const totalHours = quote.workItems.reduce((sum: number, item: any) => sum + item.hours, 0);
        totalHoursByCategory.push(totalHours);

        // Samla materialkostnader
        if (quote.summary.materialCost) {
          materialCosts.push(quote.summary.materialCost);
        }

        // Beräkna arbete/material-ratio
        if (quote.summary.workCost && quote.summary.materialCost) {
          const ratio = quote.summary.materialCost / quote.summary.workCost;
          workMaterialRatios.push(ratio);
        }
      });

      // Beräkna median och range för varje arbetstyp
      for (const [workType, rates] of hourlyRatesByType.entries()) {
        if (rates.length < 3) continue; // Kräv minst 3 datapunkter

        const sorted = rates.sort((a, b) => a - b);
        const p10 = sorted[Math.floor(rates.length * 0.1)];
        const p90 = sorted[Math.floor(rates.length * 0.9)];
        const median = sorted[Math.floor(rates.length * 0.5)];

        benchmarks.push({
          work_category: category,
          metric_type: `hourly_rate_${workType.toLowerCase()}`,
          min_value: p10,
          max_value: p90,
          median_value: median,
          sample_size: rates.length
        });
      }

      // Beräkna typiska timmar för kategorin
      if (totalHoursByCategory.length >= 3) {
        const sorted = totalHoursByCategory.sort((a, b) => a - b);
        const p10 = sorted[Math.floor(totalHoursByCategory.length * 0.1)];
        const p90 = sorted[Math.floor(totalHoursByCategory.length * 0.9)];
        const median = sorted[Math.floor(totalHoursByCategory.length * 0.5)];

        benchmarks.push({
          work_category: category,
          metric_type: 'typical_hours',
          min_value: p10,
          max_value: p90,
          median_value: median,
          sample_size: totalHoursByCategory.length
        });
      }

      // Beräkna material/arbete-ratio
      if (workMaterialRatios.length >= 3) {
        const sorted = workMaterialRatios.sort((a, b) => a - b);
        const p10 = sorted[Math.floor(workMaterialRatios.length * 0.1)];
        const p90 = sorted[Math.floor(workMaterialRatios.length * 0.9)];
        const median = sorted[Math.floor(workMaterialRatios.length * 0.5)];

        benchmarks.push({
          work_category: category,
          metric_type: 'material_work_ratio',
          min_value: p10,
          max_value: p90,
          median_value: median,
          sample_size: workMaterialRatios.length
        });
      }
    }

    console.log(`Generated ${benchmarks.length} benchmarks`);

    // Rensa gamla benchmarks och lägg till nya
    if (benchmarks.length > 0) {
      // Ta bort gamla
      const { error: deleteError } = await supabase
        .from('industry_benchmarks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError && deleteError.code !== 'PGRST116') { // PGRST116 = no rows found (OK)
        console.error('Error deleting old benchmarks:', deleteError);
      }

      // Lägg till nya
      const { error: insertError } = await supabase
        .from('industry_benchmarks')
        .insert(benchmarks);

      if (insertError) {
        console.error('Error inserting benchmarks:', insertError);
        throw insertError;
      }

      console.log('Successfully updated benchmarks');
    }

    return new Response(
      JSON.stringify({ 
        message: 'Industry data aggregated successfully (GDPR-compliant)',
        processed: quotes.length,
        totalCategories: categories.size,
        gdprCompliantCategories: validCategories.size,
        skippedForPrivacy: categories.size - validCategories.size,
        benchmarks: benchmarks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in aggregate-industry-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});