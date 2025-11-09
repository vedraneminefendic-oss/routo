import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers to safely parse AI JSON
function stripMarkdownCodeFences(text: string): string {
  if (!text) return text;
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
function parseAIJSON(text: string): any {
  const t = (text || '').trim();
  if (!t) return {};
  try { return JSON.parse(stripMarkdownCodeFences(t)); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i !== -1 && j > i) { const sub = t.slice(i, j + 1); try { return JSON.parse(sub); } catch {} }
  console.error('❌ parseAIJSON failed (market-data). Raw:', t.slice(0, 500));
  throw new Error('Invalid AI JSON');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting market data fetch...');
    console.log('🤖 AI model (market-data):', 'google/gemini-2.5-flash');

    // 1. Fetch SCB Construction Cost Index
    let inflationMultiplier = 1.0;
    try {
      const scbResponse = await fetch(
        'https://api.scb.se/OV0104/v1/doris/sv/ssd/START/PR/PR0502/KostnadL',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: [
              { code: "Region", selection: { filter: "item", values: ["00"] } }, // Hela landet
              { code: "Kostnadsslag", selection: { filter: "item", values: ["TOT"] } } // Total
            ],
            response: { format: "json" }
          })
        }
      );
      
      const scbData = await scbResponse.json();
      const latestIndex = scbData.data[scbData.data.length - 1].values[0]; // Ex: 145.3
      const baselineIndex = 100; // 2015 = 100
      inflationMultiplier = parseFloat(latestIndex) / baselineIndex; // Ex: 1.453
      
      console.log(`📊 SCB Index: ${latestIndex} (${inflationMultiplier.toFixed(2)}x sedan 2015)`);
    } catch (scbError) {
      console.error('⚠️ SCB API error, using default multiplier 1.0:', scbError);
    }

    // 2. Use Lovable AI to search web for market insights
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Du är en byggbransch-analytiker. Extrahera numeriska värden från källor och returnera endast JSON utan extra text.'
          },
          {
            role: 'user',
            content: `
FAS 4: Sök på webben och sammanfatta genomsnittliga kostnader i Sverige 2025 för följande 15 kategorier:

1. Badrumsrenovering (kr/kvm, inkl material + arbete)
2. Köksrenovering (kr/kvm)
3. Målning (kr/kvm)
4. Trädfällning (kr per träd, flat cost)
5. Stubbfräsning (kr per stubb, flat cost)
6. Golvläggning (kr/kvm)
7. Takarbete (kr/kvm)
8. Städning (kr flat cost för hus)
9. El-installation (kr flat cost)
10. VVS-installation (kr flat cost)
11. Fönsterbyte (kr flat cost per fönster)
12. Fasadrenovering (kr/kvm)
13. Altanbygge (kr/kvm)
14. Vindsisolering (kr/kvm)
15. Trädgårdsanläggning (kr/kvm)

Format svar som JSON (returnera ENDAST JSON, ingen annan text):
{
  "badrum_renovering": { "minPerSqm": 15000, "maxPerSqm": 25000 },
  "kok_renovering": { "minPerSqm": 20000, "maxPerSqm": 35000 },
  "malning": { "minPerSqm": 300, "maxPerSqm": 600 },
  "tree_felling": { "minPerSqm": 5000, "maxPerSqm": 25000 },
  "stump_grinding": { "minPerSqm": 2000, "maxPerSqm": 8000 },
  "flooring": { "minPerSqm": 300, "maxPerSqm": 800 },
  "roofing": { "minPerSqm": 800, "maxPerSqm": 1800 },
  "cleaning": { "minPerSqm": 1500, "maxPerSqm": 5000 },
  "electrical": { "minPerSqm": 5000, "maxPerSqm": 25000 },
  "plumbing": { "minPerSqm": 8000, "maxPerSqm": 30000 },
  "windows": { "minPerSqm": 8000, "maxPerSqm": 35000 },
  "facade": { "minPerSqm": 500, "maxPerSqm": 1200 },
  "deck": { "minPerSqm": 2000, "maxPerSqm": 4500 },
  "attic_insulation": { "minPerSqm": 150, "maxPerSqm": 350 },
  "landscaping": { "minPerSqm": 300, "maxPerSqm": 1000 }
}

Använd källor: byggfakta.se, husbyggaren.se, byggahus.se, rormokarna.se
            `
          }
        ]
      })
    });

    const aiData = await aiResponse.json();
    console.log('🤖 Raw AI response:', aiData);
    
    const aiContent = aiData.choices?.[0]?.message?.content || '{}';
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    const marketInsights = jsonMatch ? parseAIJSON(jsonMatch[0]) : {};
    
    console.log('🤖 AI Market Insights:', marketInsights);

    // 3. Update industry_benchmarks with external data
    const updates = [];
    
    for (const [category, data] of Object.entries(marketInsights)) {
      if (!data || typeof data !== 'object' || !('minPerSqm' in data) || !('maxPerSqm' in data)) {
        console.warn(`⚠️ Skipping invalid data for ${category}:`, data);
        continue;
      }
      
      // Apply inflation adjustment
      const adjustedMin = (data as any).minPerSqm * inflationMultiplier;
      const adjustedMax = (data as any).maxPerSqm * inflationMultiplier;
      const median = (adjustedMin + adjustedMax) / 2;
      
      updates.push({
        work_category: category,
        metric_type: 'price_per_sqm',
        median_value: median,
        min_value: adjustedMin,
        max_value: adjustedMax,
        sample_size: 1, // External source = 1 "sample"
        last_updated: new Date().toISOString()
      });
    }

    console.log(`📝 Preparing to update ${updates.length} categories`);

    // Upsert into database
    let successCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from('industry_benchmarks')
        .upsert(update, { 
          onConflict: 'work_category,metric_type',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`❌ Failed to update ${update.work_category}:`, error);
      } else {
        successCount++;
        console.log(`✅ Updated ${update.work_category}: ${Math.round(update.median_value)} kr/kvm`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updatedCategories: successCount,
        totalAttempted: updates.length,
        inflationMultiplier: inflationMultiplier.toFixed(3),
        message: `Uppdaterade ${successCount} av ${updates.length} kategorier med externa data` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error fetching market data:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
