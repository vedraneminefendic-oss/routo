import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Standard test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Badrumsrenovering 6kvm standard',
    description: 'Renovera badrum 6 kvadratmeter, byta kakel, golvvärme, dusch',
    expected_min: 70000,
    expected_max: 90000,
    input: {
      description: 'Renovera badrum 6 kvadratmeter, byta kakel, golvvärme, installera dusch',
      measurements: { area: 6 },
      qualityLevel: 'standard'
    }
  },
  {
    name: 'Målning lägenhet 100kvm',
    description: 'Måla väggar och tak i lägenhet 100kvm',
    expected_min: 25000,
    expected_max: 35000,
    input: {
      description: 'Måla väggar och tak i lägenhet 100 kvadratmeter',
      measurements: { area: 100 },
      qualityLevel: 'standard'
    }
  },
  {
    name: 'Kök renovering 12kvm premium',
    description: 'Köksomsättning 12 kvadratmeter med nya luckor, bänkskiva, vitvaror',
    expected_min: 120000,
    expected_max: 160000,
    input: {
      description: 'Renovera kök 12 kvadratmeter, nya luckor, bänkskiva, vitvaror premium',
      measurements: { area: 12 },
      qualityLevel: 'premium'
    }
  },
  {
    name: 'Trädgård - fälla träd 3 st',
    description: 'Fälla 3 medelstora träd och ta bort stubbar',
    expected_min: 15000,
    expected_max: 25000,
    input: {
      description: 'Fälla 3 träd i trädgård, medelstor höjd, ta bort stubbar',
      measurements: { quantity: 3 },
      qualityLevel: 'standard'
    }
  },
  {
    name: 'RUT-städning villa 150kvm',
    description: 'Storstädning av villa 150 kvadratmeter',
    expected_min: 8000,
    expected_max: 12000,
    input: {
      description: 'Storstädning av villa 150 kvadratmeter med fönsterputs',
      measurements: { area: 150 },
      qualityLevel: 'standard'
    }
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧪 Starting regression tests...');

    const results = [];
    let passedCount = 0;
    let failedCount = 0;

    for (const scenario of TEST_SCENARIOS) {
      console.log(`Testing: ${scenario.name}`);

      try {
        // Call generate-quote edge function
        const { data: quoteData, error: quoteError } = await supabase.functions.invoke('generate-quote', {
          body: scenario.input
        });

        if (quoteError) throw quoteError;

        const actualPrice = quoteData?.summary?.totalBeforeVAT || 0;
        const deviationPercent = actualPrice > 0 
          ? (Math.abs(actualPrice - (scenario.expected_min + scenario.expected_max) / 2) / ((scenario.expected_min + scenario.expected_max) / 2)) * 100
          : 100;

        const passed = actualPrice >= scenario.expected_min && actualPrice <= scenario.expected_max;
        
        if (passed) {
          passedCount++;
          console.log(`✅ PASSED: ${scenario.name} (${actualPrice} kr)`);
        } else {
          failedCount++;
          console.log(`❌ FAILED: ${scenario.name} (${actualPrice} kr, expected ${scenario.expected_min}-${scenario.expected_max})`);
        }

        // Store result
        await supabase.from('regression_test_results').insert({
          test_name: scenario.name,
          scenario_description: scenario.description,
          expected_price_min: scenario.expected_min,
          expected_price_max: scenario.expected_max,
          actual_price: actualPrice,
          price_deviation_percent: deviationPercent,
          passed,
          test_output: quoteData
        });

        results.push({
          test: scenario.name,
          passed,
          expected: `${scenario.expected_min}-${scenario.expected_max} kr`,
          actual: `${actualPrice} kr`,
          deviation: `${deviationPercent.toFixed(1)}%`
        });

      } catch (error: any) {
        console.error(`Error in test ${scenario.name}:`, error);
        failedCount++;
        
        await supabase.from('regression_test_results').insert({
          test_name: scenario.name,
          scenario_description: scenario.description,
          expected_price_min: scenario.expected_min,
          expected_price_max: scenario.expected_max,
          actual_price: 0,
          price_deviation_percent: 100,
          passed: false,
          test_output: { error: error.message }
        });

        results.push({
          test: scenario.name,
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
        total: TEST_SCENARIOS.length,
        passed: passedCount,
        failed: failedCount,
        results,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Regression tests complete: ${passedCount}/${TEST_SCENARIOS.length} passed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total: TEST_SCENARIOS.length,
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