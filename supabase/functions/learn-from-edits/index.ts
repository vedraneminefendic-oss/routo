// ============================================
// LEARN FROM EDITS - Edge Function (FÖRBÄTTRING #6)
// Analyserar användarens ändringar i offerter och sparar mönster
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const { originalQuote, editedQuote, quoteId } = await req.json();

    console.log('🎓 Learning from user edits for quote:', quoteId);

    // Analyze changes
    const changes = analyzeChanges(originalQuote, editedQuote);

    console.log('📝 Changes detected:', JSON.stringify(changes, null, 2));

    // Get existing user patterns
    const { data: existingPatterns } = await supabaseClient
      .from('user_quote_patterns')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Update or create patterns
    const commonEdits = existingPatterns?.common_edits || [];
    const updatedEdits = [...commonEdits, ...changes.edits];

    // Calculate new averages
    const newPatterns = {
      user_id: user.id,
      average_hourly_rate: calculateAverageRate(editedQuote),
      average_material_ratio: calculateMaterialRatio(editedQuote),
      common_edits: updatedEdits.slice(-50), // Keep last 50 edits
      total_quotes: (existingPatterns?.total_quotes || 0) + 1,
      last_updated: new Date().toISOString(),
    };

    // Upsert patterns
    const { error: upsertError } = await supabaseClient
      .from('user_quote_patterns')
      .upsert(newPatterns);

    if (upsertError) {
      console.error('Error upserting patterns:', upsertError);
      throw upsertError;
    }

    console.log('✅ Learned from edits successfully');

    return new Response(
      JSON.stringify({
        success: true,
        changes_detected: changes.edits.length,
        patterns_updated: true,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error learning from edits:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function analyzeChanges(original: any, edited: any): { edits: any[] } {
  const edits: any[] = [];

  // 1. Check if work items were added
  const originalWorkItems = original.workItems || [];
  const editedWorkItems = edited.workItems || [];

  if (editedWorkItems.length > originalWorkItems.length) {
    const addedCount = editedWorkItems.length - originalWorkItems.length;
    edits.push({
      type: 'work_items_added',
      count: addedCount,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Check if work items were removed
  if (editedWorkItems.length < originalWorkItems.length) {
    const removedCount = originalWorkItems.length - editedWorkItems.length;
    edits.push({
      type: 'work_items_removed',
      count: removedCount,
      timestamp: new Date().toISOString(),
    });
  }

  // 3. Check if prices were adjusted
  const originalTotal = original.summary?.totalBeforeVAT || 0;
  const editedTotal = edited.summary?.totalBeforeVAT || 0;
  const priceDiff = editedTotal - originalTotal;

  if (Math.abs(priceDiff) > 100) {
    edits.push({
      type: 'total_price_adjusted',
      original_total: Math.round(originalTotal),
      edited_total: Math.round(editedTotal),
      difference: Math.round(priceDiff),
      percentage_change: Math.round((priceDiff / originalTotal) * 100),
      timestamp: new Date().toISOString(),
    });
  }

  // 4. Check if hourly rates were changed
  const originalRates = originalWorkItems.map((w: any) => w.hourlyRate).filter((r: number) => r > 0);
  const editedRates = editedWorkItems.map((w: any) => w.hourlyRate).filter((r: number) => r > 0);

  if (originalRates.length > 0 && editedRates.length > 0) {
    const originalAvg = originalRates.reduce((a: number, b: number) => a + b, 0) / originalRates.length;
    const editedAvg = editedRates.reduce((a: number, b: number) => a + b, 0) / editedRates.length;

    if (Math.abs(editedAvg - originalAvg) > 50) {
      edits.push({
        type: 'hourly_rate_adjusted',
        original_avg: Math.round(originalAvg),
        edited_avg: Math.round(editedAvg),
        difference: Math.round(editedAvg - originalAvg),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 5. Check if materials were changed
  const originalMaterials = original.materials || [];
  const editedMaterials = edited.materials || [];

  if (editedMaterials.length !== originalMaterials.length) {
    edits.push({
      type: 'materials_modified',
      original_count: originalMaterials.length,
      edited_count: editedMaterials.length,
      timestamp: new Date().toISOString(),
    });
  }

  // 6. Check if time estimates were changed
  const originalHours = originalWorkItems.reduce((sum: number, w: any) => sum + (w.hours || 0), 0);
  const editedHours = editedWorkItems.reduce((sum: number, w: any) => sum + (w.hours || 0), 0);

  if (Math.abs(editedHours - originalHours) > 2) {
    edits.push({
      type: 'time_estimate_adjusted',
      original_hours: Math.round(originalHours * 10) / 10,
      edited_hours: Math.round(editedHours * 10) / 10,
      difference: Math.round((editedHours - originalHours) * 10) / 10,
      timestamp: new Date().toISOString(),
    });
  }

  return { edits };
}

function calculateAverageRate(quote: any): number {
  const workItems = quote.workItems || [];
  const rates = workItems
    .map((w: any) => w.hourlyRate)
    .filter((r: number) => r > 0);

  if (rates.length === 0) return 0;
  return Math.round(rates.reduce((a: number, b: number) => a + b, 0) / rates.length);
}

function calculateMaterialRatio(quote: any): number {
  const materialCost = quote.summary?.materialCost || 0;
  const workCost = quote.summary?.workCost || 0;

  if (workCost === 0) return 0;
  return Math.round((materialCost / workCost) * 100) / 100;
}
