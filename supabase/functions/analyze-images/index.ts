import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, description } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    if (!images || images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No images provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare vision prompt
    const visionPrompt = `Analysera dessa bilder för ett hantverks/renoveringsprojekt. Extrahera:

1. MÅTT & AREA:
   - Rum-dimensioner (längd × bredd i meter)
   - Total area i kvadratmeter
   - Vägg-höjd om synlig
   - Antal föremål (dörrar, fönster, träd, etc.)

2. RUM-TYP & KATEGORI:
   - Identifiera rum (badrum, kök, vardagsrum, etc.)
   - Projekttyp (renovering, målning, trädfällning, etc.)

3. SKADOR & ARBETE:
   - Synliga skador eller problem
   - Material som behöver bytas
   - Uppskattad arbetsomfattning

4. MATERIAL & FINISH:
   - Nuvarande material (kakel, trä, målning, etc.)
   - Kvalitetsnivå (budget/mellan/premium)
   - Special-krav (fuktskydd, isolering, etc.)

Beskrivning från kunden: ${description || 'Ingen beskrivning tillgänglig'}

Svara i JSON-format:
{
  "measurements": {
    "area": number (kvm),
    "height": number (meter),
    "length": number (meter),
    "width": number (meter),
    "quantity": number (antal föremål)
  },
  "roomType": string,
  "projectCategory": string,
  "damages": string[],
  "materials": {
    "current": string,
    "qualityLevel": "budget" | "mellan" | "premium"
  },
  "workScope": string,
  "specialRequirements": string[],
  "confidence": "low" | "medium" | "high"
}`;

    // Prepare content array with text and images
    const content: any[] = [
      { type: "text", text: visionPrompt }
    ];

    // Add all images (base64 or URLs)
    for (const image of images) {
      content.push({
        type: "image_url",
        image_url: {
          url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
        }
      });
    }

    // Call Lovable AI with Gemini 2.5 Flash (vision model)
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content;

    if (!analysisText) {
      throw new Error('No analysis returned from AI');
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', analysisText);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('📸 Image analysis completed:', analysis);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-images:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to analyze images'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
