import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutlierQuote {
  id: string;
  title: string;
  total_cost: number;
  work_category: string;
  price_per_sqm?: number;
  deviation_percent: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Starting outlier detection for quotes from last 7 days...');

    // Get quotes from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, title, description, generated_quote, edited_quote, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .in('status', ['accepted', 'completed', 'sent']);

    if (quotesError) throw quotesError;

    if (!quotes || quotes.length === 0) {
      console.log('No quotes found in last 7 days');
      await supabase.from('market_data_logs').insert({
        status: 'success',
        source: 'outlier_detection',
        records_updated: 0,
        details: { message: 'No quotes to analyze', period: '7_days' }
      });

      return new Response(
        JSON.stringify({ success: true, outliers: [], analyzed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get industry benchmarks
    const { data: benchmarks, error: benchmarksError } = await supabase
      .from('industry_benchmarks')
      .select('*');

    if (benchmarksError) throw benchmarksError;

    const outliers: OutlierQuote[] = [];
    let analyzedCount = 0;

    for (const quote of quotes) {
      analyzedCount++;
      const quoteData = quote.edited_quote || quote.generated_quote;
      if (!quoteData) continue;

      const totalCost = quoteData.summary?.totalBeforeVAT || 0;
      const area = quoteData.measurements?.area || 0;

      // Determine work category
      const description = quote.description?.toLowerCase() || '';
      let workCategory = 'other';
      
      if (description.includes('badrum') && description.includes('renover')) {
        workCategory = 'badrum_renovering';
      } else if (description.includes('kök') && description.includes('renover')) {
        workCategory = 'kok_renovering';
      } else if (description.includes('målning') || description.includes('måla')) {
        workCategory = 'malning';
      } else if (description.includes('städ')) {
        workCategory = 'stadning';
      } else if (description.includes('trädgård')) {
        workCategory = 'tradgard';
      }

      // Find matching benchmark
      const benchmark = benchmarks?.find(
        b => b.work_category === workCategory && b.metric_type === 'price_per_sqm'
      );

      if (benchmark && area > 0) {
        const pricePerSqm = totalCost / area;
        const medianPrice = benchmark.median_value;
        const minAcceptable = medianPrice * 0.7; // 30% tolerance
        const maxAcceptable = medianPrice * 1.3;

        if (pricePerSqm < minAcceptable || pricePerSqm > maxAcceptable) {
          const deviationPercent = ((pricePerSqm - medianPrice) / medianPrice) * 100;
          
          outliers.push({
            id: quote.id,
            title: quote.title,
            total_cost: totalCost,
            work_category: workCategory,
            price_per_sqm: pricePerSqm,
            deviation_percent: Math.round(deviationPercent)
          });

          console.log(`⚠️ Outlier detected: ${quote.title} (${deviationPercent.toFixed(1)}% deviation)`);
        }
      }
    }

    // Log results
    await supabase.from('market_data_logs').insert({
      status: outliers.length > 0 ? 'outliers_detected' : 'success',
      source: 'outlier_detection',
      records_updated: outliers.length,
      details: {
        analyzed: analyzedCount,
        outliers: outliers,
        period: '7_days',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Outlier detection complete: ${outliers.length} outliers found in ${analyzedCount} quotes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        outliers,
        analyzed: analyzedCount,
        outlier_count: outliers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in outlier detection:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});