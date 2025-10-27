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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🌐 Updating industry standards from web search...');

    const projectTypes = ['målning', 'badrum', 'kök', 'städning', 'el', 'vvs', 'trädgård'];
    const updated: string[] = [];

    for (const projectType of projectTypes) {
      console.log(`🔍 Searching for ${projectType} standards...`);

      // Use AI to search and synthesize industry standards
      const prompt = `Analysera aktuella branschstandarder för ${projectType}arbeten i Sverige 2025.

Lista standardmoment som ALLTID ingår i en ${projectType}offert, även om kunden inte nämner dem explicit.

Returnera JSON:
{
  "standardWorkItems": [
    {
      "name": "Moment namn",
      "mandatory": true/false,
      "reasoning": "Varför detta alltid ingår"
    }
  ],
  "priceIndicators": {
    "typical_hourly_rate": "700-900 kr/h",
    "typical_material_ratio": "0.3-0.5"
  }
}`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          }),
        });

        if (!aiResponse.ok) {
          console.error(`❌ AI request failed for ${projectType}: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;
        
        if (!content) {
          console.error(`❌ No AI response for ${projectType}`);
          continue;
        }

        const standards = JSON.parse(content);

        // Save to database
        const { error: upsertError } = await supabase
          .from('industry_knowledge')
          .upsert({
            category: 'standard_work_items',
            project_type: projectType,
            content: standards,
            source: 'ai_synthesis',
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'category,project_type'
          });

        if (upsertError) {
          console.error(`❌ Error saving ${projectType}:`, upsertError);
        } else {
          updated.push(projectType);
          console.log(`✅ Updated standards for ${projectType}`);
        }

      } catch (error) {
        console.error(`❌ Error processing ${projectType}:`, error);
      }
    }

    console.log(`✅ Industry standards update complete. Updated: ${updated.join(', ')}`);

    return new Response(
      JSON.stringify({ success: true, updated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error updating industry standards:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
