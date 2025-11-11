import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runRegressionTests } from "../generate-quote/helpers/regressionTests.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Running Regression Tests for Fas 1-3');
    
    // Kör alla tester
    const testResults = await runRegressionTests();
    
    // Returnera resultatet
    return new Response(
      JSON.stringify(testResults, null, 2),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200,
      },
    );
    
  } catch (error) {
    console.error('❌ Regression test error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500,
      },
    );
  }
});
