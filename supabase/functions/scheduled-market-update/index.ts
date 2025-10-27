import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting scheduled market data update...');

    // Call the fetch-market-data function
    const { data: marketData, error: marketError } = await supabase.functions.invoke('fetch-market-data', {
      body: { source: 'scheduled-cron' }
    });

    if (marketError) {
      console.error('❌ Market data fetch failed:', marketError);
      throw marketError;
    }

    // Log the update
    const { error: logError } = await supabase
      .from('market_data_logs')
      .insert({
        status: 'success',
        records_updated: marketData?.recordsUpdated || 0,
        source: 'cron',
        details: marketData
      });

    if (logError) {
      console.warn('⚠️ Failed to log market update:', logError);
    }

    console.log('✅ Market data updated successfully:', marketData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Market data updated successfully',
        recordsUpdated: marketData?.recordsUpdated || 0,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in scheduled-market-update:', error);
    
    // Log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('market_data_logs')
        .insert({
          status: 'error',
          records_updated: 0,
          source: 'cron',
          details: { error: error instanceof Error ? error.message : String(error) }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
