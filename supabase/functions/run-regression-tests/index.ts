import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { limit, job_type } = await req.json();

    // Fetch golden tests
    let query = supabaseClient
      .from('golden_tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (job_type) {
      query = query.eq('job_type', job_type);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: goldenTests, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!goldenTests || goldenTests.length === 0) {
      return new Response(
        JSON.stringify({ 
          total: 0, 
          passed: 0, 
          failed: 0, 
          results: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const test of goldenTests) {
      console.log(`🧪 Running test: ${test.test_name} (${test.job_type})`);

      try {
        // Call generate-quote with test input
        const { data: quoteData, error: quoteError } = await supabaseClient.functions.invoke(
          'generate-quote',
          {
            body: {
              ...test.input_data,
              sessionId: `regression-test-${test.id}`,
            },
            headers: {
              'x-regression-test': 'true',
              'x-internal-regression-secret': Deno.env.get('REGRESSION_SECRET') || 'test-secret'
            }
          }
        );

        if (quoteError) {
          throw new Error(quoteError.message);
        }

        const actualPrice = quoteData?.quote?.summary?.customerPays || 0;
        const actualHours = quoteData?.quote?.workItems?.reduce(
          (sum: number, item: any) => sum + (item.hours || item.estimatedHours || 0), 
          0
        ) || 0;

        // Check if price is within expected range
        const priceInRange = 
          actualPrice >= test.expected_price_min && 
          actualPrice <= test.expected_price_max;

        // Check if hours are within expected range (if specified)
        const hoursInRange = 
          !test.expected_hours_min || 
          !test.expected_hours_max ||
          (actualHours >= test.expected_hours_min && actualHours <= test.expected_hours_max);

        const testPassed = priceInRange && hoursInRange;

        if (testPassed) {
          passed++;
        } else {
          failed++;
        }

        // Calculate deviation
        const expectedMid = (test.expected_price_min + test.expected_price_max) / 2;
        const priceDeviation = ((actualPrice - expectedMid) / expectedMid) * 100;

        results.push({
          test_name: test.test_name,
          job_type: test.job_type,
          passed: testPassed,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: actualPrice,
          price_deviation_percent: priceDeviation,
          expected_hours_min: test.expected_hours_min,
          expected_hours_max: test.expected_hours_max,
          actual_hours: actualHours,
        });

        // Save result to database
        await supabaseClient.from('regression_test_results').insert({
          test_name: test.test_name,
          scenario_description: test.scenario_description,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: actualPrice,
          price_deviation_percent: priceDeviation,
          passed: testPassed,
          test_output: quoteData?.quote,
        });

        // Update golden test stats
        await supabaseClient
          .from('golden_tests')
          .update({
            run_count: (test.run_count || 0) + 1,
            pass_count: (test.pass_count || 0) + (testPassed ? 1 : 0),
            last_run_at: new Date().toISOString(),
          })
          .eq('id', test.id);

      } catch (error: any) {
        console.error(`❌ Test failed: ${test.test_name}`, error);
        
        failed++;
        results.push({
          test_name: test.test_name,
          job_type: test.job_type,
          passed: false,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: 0,
          price_deviation_percent: 100,
          error: error.message,
        });

        // Save error to database
        await supabaseClient.from('regression_test_results').insert({
          test_name: test.test_name,
          scenario_description: test.scenario_description,
          expected_price_min: test.expected_price_min,
          expected_price_max: test.expected_price_max,
          actual_price: 0,
          price_deviation_percent: 100,
          passed: false,
          test_output: { error: error.message },
        });
      }
    }

    // Log summary
    await supabaseClient.from('market_data_logs').insert({
      source: 'regression_tests',
      status: 'success',
      records_updated: results.length,
      details: {
        total: results.length,
        passed,
        failed,
        pass_rate: ((passed / results.length) * 100).toFixed(1) + '%',
      },
    });

    return new Response(
      JSON.stringify({
        total: results.length,
        passed,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Regression test error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
