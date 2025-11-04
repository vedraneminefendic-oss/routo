import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { quoteId } = await req.json();

    if (!quoteId) {
      throw new Error('quoteId is required');
    }

    console.log('📚 Learning from accepted quote:', quoteId);

    // Fetch quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;

    const quoteData = quote.edited_quote || quote.generated_quote;
    if (!quoteData || !quoteData.workItems) {
      console.log('⚠️ No work items to learn from');
      return new Response(JSON.stringify({ success: true, learned: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detect project type from description
    const description = quote.description.toLowerCase();
    let projectType = 'other';
    
    if (description.includes('målning') || description.includes('måla')) projectType = 'målning';
    else if (description.includes('badrum')) projectType = 'badrum';
    else if (description.includes('kök')) projectType = 'kök';
    else if (description.includes('städ')) projectType = 'städning';
    else if (description.includes('trädgård')) projectType = 'trädgård';
    else if (description.includes('el') || description.includes('elektr')) projectType = 'el';
    else if (description.includes('vvs') || description.includes('rör')) projectType = 'vvs';

    console.log(`📊 Project type detected: ${projectType}`);

    // Determine which items were explicitly mentioned vs AI-kept
    const conversationText = (quote.description || '').toLowerCase();
    const patterns: any[] = [];

    for (const item of quoteData.workItems) {
      const itemKeywords = item.name
        .toLowerCase()
        .split(/[\s\-,\/]+/)
        .filter((kw: string) => kw.length >= 4);
      
      const wasExplicitlyMentioned = itemKeywords.some((kw: string) => 
        conversationText.includes(kw)
      );

      // Check if this was a standard work item (kept by AI)
      const wasKeptByAI = !wasExplicitlyMentioned && item.subtotal > 5000;

      patterns.push({
        user_id: quote.user_id,
        project_type: projectType,
        work_item_name: item.name,
        was_explicitly_mentioned: wasExplicitlyMentioned,
        was_kept_by_ai: wasKeptByAI,
        customer_accepted: true,
        quote_id: quoteId,
        confidence_score: wasKeptByAI ? 0.85 : 1.0,
        ai_reasoning: wasKeptByAI 
          ? `Inkluderat som standardmoment för ${projectType}, accepterat av kund`
          : 'Explicit efterfrågat av kund'
      });

      console.log(`✅ ${item.name}: mentioned=${wasExplicitlyMentioned}, AI-kept=${wasKeptByAI}`);
    }

    // Save patterns
    if (patterns.length > 0) {
      const { error: insertError } = await supabase
        .from('accepted_work_patterns')
        .insert(patterns);

      if (insertError) {
        console.error('❌ Error saving patterns:', insertError);
        throw insertError;
      }

      console.log(`📚 Saved ${patterns.length} work patterns to database`);
    }

    // Automatically update user patterns (AI profile)
    console.log('🤖 Auto-updating user AI profile...');
    try {
      const { data: updateData, error: updateError } = await supabase.functions.invoke('update-user-patterns', {
        body: { user_id: quote.user_id }
      });

      if (updateError) {
        console.error('⚠️ Failed to auto-update user patterns:', updateError);
        // Don't throw - this is a nice-to-have, not critical
      } else {
        console.log('✅ User AI profile auto-updated:', updateData);
        
        // Log to market_data_logs
        await supabase.from('market_data_logs').insert({
          status: 'success',
          source: 'ai_profile_auto_update',
          records_updated: 1,
          details: {
            trigger: 'quote_accepted',
            quote_id: quoteId,
            user_id: quote.user_id,
            message: 'AI profile automatically updated after quote acceptance'
          }
        });
      }
    } catch (error) {
      console.error('⚠️ Exception during auto-update of user patterns:', error);
      // Continue execution - not critical
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        learned: patterns.length,
        projectType,
        ai_profile_updated: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error learning from accepted quote:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
