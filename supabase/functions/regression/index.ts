import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-regression-test, x-internal-regression-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📊 Running regression tests on all golden tests...');

    // Parse query parameters for filtering
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const jobTypeParam = url.searchParams.get('job_type');
    
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const jobType = jobTypeParam || undefined;

    // Fetch golden tests with optional filtering
    let query = supabase
      .from('golden_tests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    if (jobType) {
      query = query.eq('job_type', jobType);
    }

    const { data: goldenTests, error: fetchError } = await query;

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

    const results: any[] = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const test of goldenTests) {
      console.log(`🧪 Running test: ${test.test_name} (${test.job_type})...`);

      try {
        // Call generate-quote edge function with internal regression headers
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-quote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': ' ', // Neutralize auth header to avoid JWT validation
            'x-regression-test': '1',
            'x-internal-regression-secret': supabaseKey,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!
          },
          body: JSON.stringify(test.input_data)
        });

        let quoteData: any;
        let quoteError: any = null;
        let errorDetails: any = null;

        if (!response.ok) {
          const responseClone = response.clone();
          const contentType = response.headers.get('content-type');
          const bodyText = await responseClone.text();
          
          errorDetails = {
            status: response.status,
            contentType,
            bodyText: bodyText.substring(0, 500), // First 500 chars
            json: undefined as any
          };

          try {
            const errorJson = JSON.parse(bodyText);
            errorDetails.json = errorJson;
            quoteError = {
              message: errorJson.error || errorJson.message || `HTTP ${response.status}`,
              details: errorJson
            };
          } catch {
            quoteError = {
              message: `HTTP ${response.status}: ${bodyText.substring(0, 100)}`,
              details: errorDetails
            };
          }
        } else {
          quoteData = await response.json();
        }

        if (quoteError) {
          throw quoteError;
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

        // Store result with golden_test_id
        await supabase.from('regression_test_results').insert({
          golden_test_id: test.id,
          test_name: test.test_name,
          scenario_description: test.scenario_description || test.test_name,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: actualPrice,
          price_deviation_percent: deviationPercent,
          passed,
          expected_output: test.expected_output,
          actual_output: quoteData,
          test_input: test.input_data,
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
        
        // Use error details from the enhanced error structure
        const detailed = error.details || { error: error.message };
        
        await supabase.from('regression_test_results').insert({
          golden_test_id: test.id,
          test_name: test.test_name,
          scenario_description: test.scenario_description || test.test_name,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: 0,
          price_deviation_percent: 100,
          passed: false,
          expected_output: test.expected_output,
          actual_output: null,
          error_message: error.message || 'Unknown error',
          test_input: test.input_data,
          test_output: detailed
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
          error: error.message || 'Unknown error',
          errorDetails: detailed
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