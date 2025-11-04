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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧪 Starting database-driven regression tests...');

    // Hämta alla golden tests från databasen
    const { data: goldenTests, error: fetchError } = await supabase
      .from('golden_tests')
      .select('*')
      .order('job_type', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching golden tests:', fetchError);
      throw fetchError;
    }

    if (!goldenTests || goldenTests.length === 0) {
      console.log('⚠️ No golden tests found in database');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No golden tests configured',
          total: 0,
          passed: 0,
          failed: 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${goldenTests.length} golden tests`);

    const results = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const test of goldenTests) {
      console.log(`Testing: ${test.test_name} (${test.job_type})`);

      try {
        // Call generate-quote edge function med input_data från databasen
        const { data: quoteData, error: quoteError } = await supabase.functions.invoke('generate-quote', {
          body: test.input_data,
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'x-regression-test': '1'
          }
        });

        if (quoteError) {
          // Try to extract detailed error message from response
          let errorDetail = quoteError.message;
          if (quoteError.context) {
            try {
              const errorBody = await quoteError.context.json();
              errorDetail = errorBody.error || errorBody.message || errorDetail;
            } catch {
              // If can't parse JSON, keep original message
            }
          }
          const enhancedError = new Error(errorDetail);
          (enhancedError as any).context = quoteError.context;
          throw enhancedError;
        }

        const actualPrice = quoteData?.summary?.totalBeforeVAT || 0;
        const expectedMid = (test.expected_price_min + test.expected_price_max) / 2;
        const deviationPercent = actualPrice > 0 
          ? (Math.abs(actualPrice - expectedMid) / expectedMid) * 100
          : 100;

        const passed = actualPrice >= test.expected_price_min && actualPrice <= test.expected_price_max;
        
        if (passed) {
          passedCount++;
          console.log(`✅ PASSED: ${test.test_name} (${actualPrice} kr)`);
        } else {
          failedCount++;
          console.log(`❌ FAILED: ${test.test_name} (${actualPrice} kr, expected ${test.expected_price_min}-${test.expected_price_max})`);
        }

        // Store result i regression_test_results
        await supabase.from('regression_test_results').insert({
          test_name: test.test_name,
          scenario_description: test.scenario_description || test.test_name,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: actualPrice,
          price_deviation_percent: deviationPercent,
          passed,
          test_output: quoteData
        });

        // Uppdatera golden_tests med run_count och pass_count
        await supabase
          .from('golden_tests')
          .update({
            run_count: (test.run_count || 0) + 1,
            pass_count: passed ? (test.pass_count || 0) + 1 : test.pass_count,
            last_run_at: new Date().toISOString()
          })
          .eq('id', test.id);

        results.push({
          test: test.test_name,
          jobType: test.job_type,
          passed,
          expected: `${test.expected_price_min}-${test.expected_price_max} kr`,
          actual: `${actualPrice} kr`,
          deviation: `${deviationPercent.toFixed(1)}%`
        });

      } catch (error: any) {
        console.error(`❌ Error in test ${test.test_name}:`, error);
        failedCount++;
        
        // Extract detailed error info for better debugging
        let errorOutput: any = { error: error.message };
        if (error.context) {
          try {
            const errorBody = await error.context.json();
            errorOutput = { error: error.message, detail: errorBody };
          } catch {
            errorOutput = { error: error.message, status: error.context?.status };
          }
        }
        
        await supabase.from('regression_test_results').insert({
          test_name: test.test_name,
          scenario_description: test.scenario_description || test.test_name,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: 0,
          price_deviation_percent: 100,
          passed: false,
          test_output: errorOutput
        });

        // Uppdatera run_count även vid fel
        await supabase
          .from('golden_tests')
          .update({
            run_count: (test.run_count || 0) + 1,
            last_run_at: new Date().toISOString()
          })
          .eq('id', test.id);

        results.push({
          test: test.test_name,
          jobType: test.job_type,
          passed: false,
          error: error.message
        });
      }
    }

    // Log summary
    await supabase.from('market_data_logs').insert({
      status: failedCount === 0 ? 'success' : 'regression_failures',
      source: 'regression_tests',
      records_updated: passedCount,
      details: {
        total: goldenTests.length,
        passed: passedCount,
        failed: failedCount,
        results,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Regression tests complete: ${passedCount}/${goldenTests.length} passed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total: goldenTests.length,
        passed: passedCount,
        failed: failedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in regression tests:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});